/**
 * Servicio principal del modulo de importaciones.
 *
 * Flujo masivo (RAM constante):
 * 1. Upload   → archivo en disco + ImportBatch PENDING
 * 2. Mapping  → usuario confirma columnas
 * 3. Process  → 202 + worker (CSV stream → createMany 500 → validate → dedup)
 * 4. Review / verificación / execute
 */
import fs from 'fs';
import path from 'path';
import { ImportStatus, StagingRowStatus, EntityType, Prisma, Gender } from '@prisma/client';
import { prisma } from '../../config/database';
import { importRepository, BatchWithRelations, StagingRowWithRelations } from './import.repository';
import { buildMapping, applyMapping, getAvailableSystemFields, inferEntityType } from './mapper.service';
import { deduplicateRow } from './dedup.service';
import { StagingToEntityData, ColumnMapping, ExtractedFields, ValidationResult, ImportBatchProgress, ImportExecuteBatchProgress } from './import.types';
import { auditService } from '../audit/audit.service';
import { getImportBatchSettings, sleep } from './import-batch.util';
import { iterateCsvRows, peekCsvHeadersAndSample, getCsvHeaders } from './csv-stream.service';
import {
  buildProgressFields,
  persistProgress,
  readErrorLog,
} from './import-progress.util';
import {
  enqueueImportProcess,
  registerImportProcessRunner,
} from './import.worker';
import {
  ImportQueryInput,
  StagingQueryInput,
  ResolveRowInput,
} from './import.validator';
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
} from '../../shared/errors/app-error';
import { PaginationMeta } from '../../shared/types/api-response.types';
import { config } from '../../config/environment';
import { logger } from '../../shared/logger/logger';
import { locationInputToCodes } from '../../shared/utils/division-politica';
import { resolveNationalityCode } from '../../shared/utils/nationality';

// ── Helpers ──────────────────────────────────────────────────────

function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
}

function normalizeGender(raw: unknown): Gender | null | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'string') return null;

  const cleaned = raw
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // Ya viene normalizado (por si el archivo trae MALE/FEMALE/OTHER)
  if (cleaned === 'male') return Gender.MALE;
  if (cleaned === 'female') return Gender.FEMALE;
  if (cleaned === 'other') return Gender.OTHER;

  // Variantes comunes en español (y abreviaturas)
  if (cleaned === 'm' || cleaned === 'masculino' || cleaned === 'hombre') return Gender.MALE;
  if (cleaned === 'f' || cleaned === 'femenino' || cleaned === 'mujer') return Gender.FEMALE;
  if (cleaned === 'o' || cleaned === 'otro') return Gender.OTHER;

  return null;
}

/**
 * Construye el displayName para una entidad a partir de los datos mapeados.
 */
function buildDisplayName(
  entityType: 'PERSON' | 'COMPANY',
  fields: ExtractedFields,
  rawData: Record<string, unknown>,
  mapping: ColumnMapping
): string {
  switch (entityType) {
    case 'PERSON': {
      const parts = [fields.extractedFirstName, fields.extractedLastName].filter(Boolean);
      return parts.length > 0 ? parts.join(' ') : 'Sin nombre';
    }
    case 'COMPANY': {
      const legalNameCol = mapping['legalName'];
      const legalName = legalNameCol ? String(rawData[legalNameCol] || '') : '';
      return fields.extractedBusinessName || legalName || 'Empresa sin nombre';
    }
  }
}

function validateRow(
  sourceType: string,
  entityType: 'PERSON' | 'COMPANY',
  fields: ExtractedFields
): ValidationResult {
  const errors: string[] = [];
  const hasPersonName = !!(fields.extractedFirstName && fields.extractedLastName);
  const hasCompany = !!(fields.extractedBusinessName || fields.extractedRuc);
  const hasCedula = !!fields.extractedCedula;
  const hasPhone = !!fields.extractedPhone;

  // Base unificada / carga general: aceptar persona O empresa (CSV suele traer solo empresa).
  if (
    sourceType === 'UNIFICADA' ||
    sourceType === 'general' ||
    sourceType === 'census'
  ) {
    if (hasPersonName || hasCompany || hasCedula) {
      return { isValid: true, errors: [] };
    }
    if (hasPhone && (fields.extractedFirstName || fields.extractedBusinessName)) {
      return { isValid: true, errors: [] };
    }
    errors.push('Se requiere al menos nombre y apellido, cédula, o empresa/RUC');
    return { isValid: false, errors };
  }

  switch (entityType) {
    case 'PERSON':
      if (!fields.extractedFirstName && !hasCedula) {
        errors.push('Nombre o cédula es requerido');
      }
      if (!fields.extractedLastName && !hasCedula && fields.extractedFirstName) {
        errors.push('Apellido es requerido');
      }
      break;
    case 'COMPANY':
      if (!hasCompany) errors.push('Nombre de empresa o RUC es requerido');
      break;
  }

  return { isValid: errors.length === 0, errors };
}

/** Libera referencias del lote y cede el event loop. */
async function releaseBatchMemory(delayMs: number): Promise<void> {
  await sleep(delayMs);
  // Permite al GC recuperar el chunk del lote anterior
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function rowToExtractedFields(row: {
  extractedCedula: string | null;
  extractedRuc: string | null;
  extractedFirstName: string | null;
  extractedLastName: string | null;
  extractedEmail: string | null;
  extractedPhone: string | null;
  extractedBusinessName: string | null;
}): ExtractedFields {
  return {
    extractedCedula: row.extractedCedula || undefined,
    extractedRuc: row.extractedRuc || undefined,
    extractedFirstName: row.extractedFirstName || undefined,
    extractedLastName: row.extractedLastName || undefined,
    extractedEmail: row.extractedEmail || undefined,
    extractedPhone: row.extractedPhone || undefined,
    extractedBusinessName: row.extractedBusinessName || undefined,
  };
}

async function countAllStagingRows(batchId: string): Promise<number> {
  return prisma.stagingRow.count({ where: { importBatchId: batchId } });
}

async function assertNotCancelled(batchId: string): Promise<void> {
  const batch = await importRepository.findBatchById(batchId);
  if (!batch) throw new NotFoundError('Lote de importación', batchId);
  if (batch.status === 'CANCELLED') {
    throw new BadRequestError('Importación cancelada');
  }
}

/**
 * Resuelve la ruta absoluta del CSV del lote (solo .csv).
 */
function resolveBatchCsvPath(fileName: string): string {
  const uploadDir = path.resolve(config.uploadDir);
  const sourcePath = path.resolve(uploadDir, fileName);

  if (!fs.existsSync(sourcePath)) {
    throw new BadRequestError('El archivo de importación ya no existe en el servidor');
  }

  if (path.extname(fileName).toLowerCase() !== '.csv') {
    throw new BadRequestError('Solo se aceptan archivos CSV UTF-8 (.csv)');
  }

  return sourcePath;
}

// ── Service ──────────────────────────────────────────────────────

export const importService = {
  // ═══════════════════════════════════════════════════════════════
  // LOTES (ImportBatch)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Listado paginado de lotes de importacion.
   */
  async listBatches(filters: ImportQueryInput) {
    const result = await importRepository.findAllBatches(filters);
    return {
      data: result.data,
      meta: buildPaginationMeta(result.total, result.page, result.limit),
    };
  },

  /**
   * Detalle de un lote con estadisticas.
   */
  async getBatch(id: string) {
    const batch = await importRepository.findBatchById(id);
    if (!batch) throw new NotFoundError('Lote de importación', id);

    // Agregar estadisticas por status de staging rows
    const stats = await importRepository.getBatchStats(id);
    const progress = buildProgressFields(batch);

    return {
      ...batch,
      stagingStats: stats,
      processed: progress.processed,
      total: progress.total,
      progressPercent: progress.progressPercent,
      progressMessage: progress.progressMessage,
      phase: progress.phase,
    };
  },

  /**
   * Subir archivo Excel y crear lote.
   * Se llama despues de que Multer guarda el archivo.
   */
  async createBatch(input: {
    file: Express.Multer.File;
    sourceType: string;
    targetEventId?: string;
  }) {
    // Si hay targetEventId, verificar que el evento exista
    if (input.targetEventId) {
      const exists = await importRepository.eventExists(input.targetEventId);
      if (!exists) throw new NotFoundError('Evento', input.targetEventId);
    }

    // Leer headers para sugerir mapeo
    const filePath = path.resolve(input.file.path);
    const headers = await getCsvHeaders(filePath);

    if (headers.length === 0) {
      throw new BadRequestError('El archivo CSV no contiene columnas válidas');
    }

    // Construir mapeo sugerido (template + auto-detect)
    const suggestedMapping = buildMapping(input.sourceType, headers);

    const batch = await importRepository.createBatch({
      fileName: input.file.filename,
      originalFileName: input.file.originalname,
      sourceType: input.sourceType,
      targetEventId: input.targetEventId,
      columnMapping: Object.keys(suggestedMapping).length > 0 ? suggestedMapping : undefined,
    });

    logger.info(`Lote de importación creado: ${batch.id}`, {
      file: input.file.originalname,
      sourceType: input.sourceType,
      headersDetected: headers.length,
      mappedFields: Object.keys(suggestedMapping).length,
    });

    return {
      ...batch,
      excelHeaders: headers,
      csvHeaders: headers,
      suggestedMapping,
      availableSystemFields: getAvailableSystemFields(),
    };
  },

  /**
   * Vista previa: headers + primeras N filas + mapeo sugerido.
   */
  async preview(batchId: string, maxRows: number = 10) {
    const batch = await importRepository.findBatchById(batchId);
    if (!batch) throw new NotFoundError('Lote de importación', batchId);

    const filePath = resolveBatchCsvPath(batch.fileName);
    const previewData = await peekCsvHeadersAndSample(filePath, maxRows);

    const currentMapping = (batch.columnMapping as ColumnMapping) || {};

    return {
      batchId: batch.id,
      fileName: batch.originalFileName,
      sourceType: batch.sourceType,
      headers: previewData.headers,
      sampleRows: previewData.rows,
      totalPreviewRows: previewData.totalSampled,
      columnMapping: currentMapping,
      availableSystemFields: getAvailableSystemFields(),
    };
  },

  /**
   * Actualizar mapeo de columnas de un lote.
   */
  async updateMapping(batchId: string, columnMapping: ColumnMapping) {
    const batch = await importRepository.findBatchById(batchId);
    if (!batch) throw new NotFoundError('Lote de importación', batchId);

    if (
      batch.status !== 'PENDING' &&
      batch.status !== 'REVIEW_REQUIRED' &&
      batch.status !== 'FAILED' &&
      batch.status !== 'CANCELLED'
    ) {
      throw new BadRequestError(
        `No se puede modificar el mapeo en estado ${batch.status}. Solo PENDING, REVIEW_REQUIRED, FAILED o CANCELLED.`
      );
    }

    if (!columnMapping || Object.keys(columnMapping).length === 0) {
      throw new BadRequestError('El mapeo de columnas no puede estar vacío');
    }

    // Resolver valores al header real del archivo (case-insensitive)
    const filePath = resolveBatchCsvPath(batch.fileName);
    const headers = await getCsvHeaders(filePath);
    const normalized = buildMapping(batch.sourceType, headers, columnMapping);

    if (Object.keys(normalized).length === 0) {
      throw new BadRequestError(
        'Ninguna columna del mapeo coincide con los headers del archivo. Verifique los nombres de columna.'
      );
    }

    const updated = await importRepository.updateBatch(batchId, {
      columnMapping: normalized as any,
    });

    return updated;
  },

  // ═══════════════════════════════════════════════════════════════
  // PROCESAMIENTO
  // ═══════════════════════════════════════════════════════════════

  /**
   * Prepara el lote: CSV stream → createMany por lotes de ~500 (sin cargar todo en RAM).
   */
  async prepareProcessing(batchId: string): Promise<ImportBatchProgress> {
    const batch = await importRepository.findBatchById(batchId);
    if (!batch) throw new NotFoundError('Lote de importación', batchId);

    if (
      batch.status !== 'PENDING' &&
      batch.status !== 'REVIEW_REQUIRED' &&
      batch.status !== 'PROCESSING' &&
      batch.status !== 'VALIDATING'
    ) {
      throw new BadRequestError(
        `No se puede procesar un lote en estado ${batch.status}. Solo PENDING, PROCESSING o VALIDATING.`
      );
    }

    const mapping = (batch.columnMapping as ColumnMapping) || {};
    if (Object.keys(mapping).length === 0) {
      throw new BadRequestError(
        'Debe configurar el mapeo de columnas antes de procesar. Use PUT /imports/:id/mapping'
      );
    }

    const { stagingInsertBatchSize, rowBatchDelayMs } = getImportBatchSettings();

    await importRepository.updateBatch(batchId, {
      status: 'PROCESSING',
      startedAt: batch.startedAt ?? new Date(),
    });

    await persistProgress(batchId, {
      processed: 0,
      total: batch.totalRows || 0,
      message: 'Preparando archivo (CSV stream)…',
      phase: 'staging',
      status: 'PROCESSING',
    });

    try {
      const existingCount = await countAllStagingRows(batchId);
      let totalRows = batch.totalRows;

      if (existingCount === 0) {
        const csvPath = resolveBatchCsvPath(batch.fileName);
        logger.info('Iniciando staging por stream CSV', { batchId, csvPath });

        let rowNumber = 0;
        let chunk: Array<{
          importBatchId: string;
          rowNumber: number;
          rawData: Record<string, unknown>;
          extractedCedula?: string;
          extractedRuc?: string;
          extractedFirstName?: string;
          extractedLastName?: string;
          extractedEmail?: string;
          extractedPhone?: string;
          extractedBusinessName?: string;
        }> = [];

        for await (const rawRow of iterateCsvRows(csvPath)) {
          await assertNotCancelled(batchId);
          rowNumber += 1;

          try {
            const fields = applyMapping(rawRow, mapping);
            chunk.push({
              importBatchId: batchId,
              rowNumber,
              rawData: rawRow,
              ...fields,
            });
          } catch (rowErr) {
            await persistProgress(batchId, {
              processed: rowNumber,
              total: Math.max(totalRows, rowNumber),
              message: `Error en fila ${rowNumber}; se omite y continúa`,
              phase: 'staging',
              appendRowError: {
                row: rowNumber,
                reason: rowErr instanceof Error ? rowErr.message : 'Error de mapeo',
              },
            });
            continue;
          }

          if (chunk.length >= stagingInsertBatchSize) {
            await importRepository.createManyStagingRows(chunk);
            totalRows = rowNumber;
            const inserted = chunk.length;
            chunk.length = 0;
            await persistProgress(batchId, {
              processed: rowNumber,
              total: rowNumber,
              totalRows: rowNumber,
              message: `Cargando staging: ${rowNumber.toLocaleString('es-PA')} filas`,
              phase: 'staging',
            });
            logger.info(`Staging batch insertado (${inserted} filas)`, {
              batchId,
              rowNumber,
            });
            await releaseBatchMemory(rowBatchDelayMs);
          }
        }

        if (chunk.length > 0) {
          await importRepository.createManyStagingRows(chunk);
          chunk.length = 0;
        }

        totalRows = rowNumber;
        if (totalRows === 0) {
          throw new BadRequestError('El archivo CSV no contiene filas de datos');
        }

        logger.info(`${totalRows} staging rows creados (stream)`, { batchId });
      } else {
        totalRows = existingCount;
      }

      await importRepository.updateBatch(batchId, {
        status: 'VALIDATING',
        totalRows,
      });

      await persistProgress(batchId, {
        processed: 0,
        total: totalRows,
        totalRows,
        message: `Validando registros (0 de ${totalRows.toLocaleString('es-PA')})`,
        phase: 'validation',
        status: 'VALIDATING',
      });

      const pending = await importRepository.countStagingByStatus(batchId, 'PENDING');

      return {
        batchId,
        status: 'VALIDATING',
        phase: 'validation',
        processedInBatch: 0,
        remaining: pending,
        totalRows,
        done: pending === 0,
      };
    } catch (error) {
      if (error instanceof BadRequestError && error.message === 'Importación cancelada') {
        throw error;
      }
      await importRepository.updateBatch(batchId, {
        status: 'FAILED',
        errorLog: {
          ...readErrorLog((await importRepository.findBatchById(batchId))?.errorLog),
          message: error instanceof Error ? error.message : 'Error desconocido',
          timestamp: new Date().toISOString(),
        } as any,
        completedAt: new Date(),
      });
      throw error;
    }
  },

  /**
   * Encola procesamiento completo en background (respuesta inmediata 202).
   */
  async startBackgroundProcess(batchId: string) {
    const batch = await importRepository.findBatchById(batchId);
    if (!batch) throw new NotFoundError('Lote de importación', batchId);

    if (batch.status !== 'PENDING') {
      throw new BadRequestError(
        `No se puede procesar un lote en estado ${batch.status}. Solo PENDING (use reintentar si ya se procesó).`
      );
    }

    const mapping = (batch.columnMapping as ColumnMapping) || {};
    if (Object.keys(mapping).length === 0) {
      throw new BadRequestError(
        'Debe configurar el mapeo de columnas antes de procesar. Use PUT /imports/:id/mapping'
      );
    }

    await importRepository.updateBatch(batchId, {
      status: 'PROCESSING',
      startedAt: new Date(),
    });

    await persistProgress(batchId, {
      processed: 0,
      total: batch.totalRows || 0,
      message: 'Importación encolada; el worker iniciará en breve',
      phase: 'staging',
      status: 'PROCESSING',
    });

    enqueueImportProcess(batchId);

    return this.getBatch(batchId);
  },

  /**
   * Worker: staging stream → validación → dedup (secuencial, concurrencia 1).
   */
  async runBackgroundProcess(batchId: string): Promise<void> {
    const batch = await importRepository.findBatchById(batchId);
    if (!batch) {
      logger.warn('Worker: lote no encontrado', { batchId });
      return;
    }

    if (batch.status === 'CANCELLED' || batch.status === 'COMPLETED') {
      return;
    }

    try {
      if (
        batch.status === 'PROCESSING' ||
        batch.status === 'PENDING'
      ) {
        const stagingCount = await countAllStagingRows(batchId);
        if (stagingCount === 0) {
          await this.prepareProcessing(batchId);
        } else if (batch.status === 'PROCESSING') {
          await importRepository.updateBatch(batchId, { status: 'VALIDATING' });
        }
      }

      // Validación + dedup por lotes secuenciales
      let progress = await this.runProcessingBatch(batchId);
      while (!progress.done) {
        await assertNotCancelled(batchId);
        const total = progress.totalRows || 1;
        const processed = Math.max(0, total - progress.remaining);
        await persistProgress(batchId, {
          processed,
          total,
          message:
            progress.phase === 'validation'
              ? `Validando registros ${processed.toLocaleString('es-PA')} de ${total.toLocaleString('es-PA')}`
              : `Deduplicando ${processed.toLocaleString('es-PA')} de ${total.toLocaleString('es-PA')}`,
          phase: progress.phase === 'deduplication' ? 'deduplication' : 'validation',
        });
        progress = await this.runProcessingBatch(batchId);
      }

      await persistProgress(batchId, {
        processed: progress.totalRows,
        total: progress.totalRows,
        message: 'Procesamiento completado',
        phase: 'done',
      });

      logger.info('Worker: importación completada', { batchId });
    } catch (error) {
      if (error instanceof BadRequestError && error.message === 'Importación cancelada') {
        logger.info('Worker: importación cancelada', { batchId });
        return;
      }

      logger.error('Worker: error crítico en importación', {
        batchId,
        error: error instanceof Error ? error.message : error,
      });

      await importRepository.updateBatch(batchId, {
        status: 'FAILED',
        completedAt: new Date(),
        errorLog: {
          ...readErrorLog((await importRepository.findBatchById(batchId))?.errorLog),
          message: error instanceof Error ? error.message : 'Error desconocido',
          timestamp: new Date().toISOString(),
        } as any,
      });
    }
  },

  /**
   * Procesa un lote de filas (validación o deduplicación) con pausa al final.
   */
  async runProcessingBatch(batchId: string): Promise<ImportBatchProgress> {
    const batch = await importRepository.findBatchById(batchId);
    if (!batch) throw new NotFoundError('Lote de importación', batchId);

    const { rowBatchSize, rowBatchDelayMs } = getImportBatchSettings();
    const mapping = (batch.columnMapping as ColumnMapping) || {};

    if (batch.status === 'VALIDATING') {
      const pendingRows = await importRepository.findPendingStagingRows(batchId, rowBatchSize);

      if (pendingRows.length === 0) {
        await importRepository.updateBatch(batchId, { status: 'DEDUPLICATING' });
        const dedupRemaining = await importRepository.countValidStagingRowsPendingDedup(batchId);
        return {
          batchId,
          status: 'DEDUPLICATING',
          phase: 'deduplication',
          processedInBatch: 0,
          remaining: dedupRemaining,
          totalRows: batch.totalRows,
          done: dedupRemaining === 0,
        };
      }

      const validIds: string[] = [];
      const invalidByError = new Map<string, { errors: string[]; ids: string[] }>();

      for (const row of pendingRows) {
        const fields = rowToExtractedFields(row);
        const entityType = inferEntityType(batch.sourceType, fields);
        const validation = validateRow(batch.sourceType, entityType, fields);

        if (validation.isValid) {
          validIds.push(row.id);
        } else {
          const key = validation.errors.join('|') || 'invalid';
          const bucket = invalidByError.get(key);
          if (bucket) {
            bucket.ids.push(row.id);
          } else {
            invalidByError.set(key, { errors: validation.errors, ids: [row.id] });
          }
        }
      }

      const processedInBatch = pendingRows.length;
      // Liberar referencias del chunk leído antes de escribir
      pendingRows.length = 0;

      await importRepository.markStagingRowsValid(validIds);
      validIds.length = 0;

      for (const group of invalidByError.values()) {
        await importRepository.markStagingRowsInvalid(group.ids, group.errors);
        group.ids.length = 0;
      }
      invalidByError.clear();

      await releaseBatchMemory(rowBatchDelayMs);

      const remaining = await importRepository.countStagingByStatus(batchId, 'PENDING');

      if (remaining === 0) {
        await importRepository.updateBatch(batchId, { status: 'DEDUPLICATING' });
      }

      return {
        batchId,
        status: remaining === 0 ? 'DEDUPLICATING' : 'VALIDATING',
        phase: remaining === 0 ? 'deduplication' : 'validation',
        processedInBatch,
        remaining,
        totalRows: batch.totalRows,
        done: false,
      };
    }

    if (batch.status === 'DEDUPLICATING') {
      const validRows = await importRepository.findValidStagingRowsPendingDedup(batchId, rowBatchSize);

      if (validRows.length === 0) {
        await importRepository.refreshBatchStats(batchId);
        await importRepository.updateBatch(batchId, { status: 'REVIEW_REQUIRED' });

        logger.info('Procesamiento completado', { batchId });

        return {
          batchId,
          status: 'REVIEW_REQUIRED',
          phase: 'done',
          processedInBatch: 0,
          remaining: 0,
          totalRows: batch.totalRows,
          done: true,
        };
      }

      const noMatchIds: string[] = [];

      for (const row of validRows) {
        const fields = rowToExtractedFields(row);
        const dedupResult = await deduplicateRow(row.id, fields);

        if (dedupResult.bestMatch) {
          const isExact = dedupResult.bestMatch.score >= 1.0;
          await importRepository.updateStagingRow(row.id, {
            status: isExact ? 'DUPLICATE_EXACT' : 'DUPLICATE_POSSIBLE',
            matchedEntityId: dedupResult.bestMatch.entityId,
            matchScore: dedupResult.bestMatch.score,
            matchReason: dedupResult.bestMatch.reason,
          });
        } else {
          noMatchIds.push(row.id);
        }
      }

      const processedInBatch = validRows.length;
      validRows.length = 0;

      await importRepository.markStagingRowsNoMatch(noMatchIds);
      noMatchIds.length = 0;

      await releaseBatchMemory(rowBatchDelayMs);

      const remaining = await importRepository.countValidStagingRowsPendingDedup(batchId);

      if (remaining === 0) {
        await importRepository.refreshBatchStats(batchId);
        await importRepository.updateBatch(batchId, { status: 'REVIEW_REQUIRED' });

        logger.info('Procesamiento completado', { batchId });

        return {
          batchId,
          status: 'REVIEW_REQUIRED',
          phase: 'done',
          processedInBatch,
          remaining: 0,
          totalRows: batch.totalRows,
          done: true,
        };
      }

      return {
        batchId,
        status: 'DEDUPLICATING',
        phase: 'deduplication',
        processedInBatch,
        remaining,
        totalRows: batch.totalRows,
        done: false,
      };
    }

    if (batch.status === 'REVIEW_REQUIRED') {
      return {
        batchId,
        status: 'REVIEW_REQUIRED',
        phase: 'done',
        processedInBatch: 0,
        remaining: 0,
        totalRows: batch.totalRows,
        done: true,
      };
    }

    throw new BadRequestError(
      `El lote debe estar en VALIDATING o DEDUPLICATING para procesar por lotes. Estado actual: ${batch.status}`
    );
  },

  /**
   * Encola el procesamiento en background (compat + path principal).
   */
  async process(batchId: string) {
    return this.startBackgroundProcess(batchId);
  },

  /**
   * Ejecuta un lote de importación final (crear entidades).
   */
  async runExecuteBatch(batchId: string): Promise<ImportExecuteBatchProgress> {
    const batch = await importRepository.findBatchById(batchId);
    if (!batch) throw new NotFoundError('Lote de importación', batchId);

    if (batch.status !== 'REVIEW_REQUIRED' && batch.status !== 'IMPORTING') {
      throw new BadRequestError(
        `No se puede importar en estado ${batch.status}. El lote debe estar en REVIEW_REQUIRED o IMPORTING.`
      );
    }

    const { rowBatchSize, rowBatchDelayMs } = getImportBatchSettings();
    const mapping = (batch.columnMapping as ColumnMapping) || {};
    const sourceOrigin = `IMPORT_${batch.sourceType}_${batch.id.substring(0, 8)}`;

    if (batch.status === 'REVIEW_REQUIRED') {
      const validCount = await importRepository.countStagingByStatus(batchId, 'VALID');
      if (validCount === 0) {
        throw new BadRequestError('No hay filas válidas para importar');
      }
      await importRepository.updateBatch(batchId, { status: 'IMPORTING' });
    }

    const validRows = await importRepository.findValidStagingRows(batchId, rowBatchSize);
    const chunk = validRows;

    if (chunk.length === 0) {
      await importRepository.refreshBatchStats(batchId);
      await importRepository.updateBatch(batchId, {
        status: 'COMPLETED',
        completedAt: new Date(),
      });

      return {
        batchId,
        status: 'COMPLETED',
        processedInBatch: 0,
        remaining: 0,
        importedTotal: batch.importedRows,
        errorTotal: await importRepository.countStagingByStatus(batchId, 'ERROR'),
        done: true,
      };
    }

    let importedInBatch = 0;
    let errorsInBatch = 0;

    for (const row of chunk) {
      try {
        const rawData = row.rawData as Record<string, unknown>;
        const fields = rowToExtractedFields(row);
        let primaryEntityId: string;

        if (batch.sourceType === 'UNIFICADA') {
          const result = await this.importUnificadaRow(
            fields,
            rawData,
            mapping,
            sourceOrigin,
            batchId,
            batch.importedById ?? undefined
          );
          primaryEntityId = result.personId;
          await auditService.log({
            action: 'CREATE',
            entityType: 'PERSON',
            entityId: result.personId,
            entityLabel: result.personName,
            userId: batch.importedById ?? undefined,
            metadata: { importBatchId: batchId, companyId: result.companyId },
          });
          await auditService.log({
            action: 'CREATE',
            entityType: 'COMPANY',
            entityId: result.companyId,
            entityLabel: result.companyName,
            userId: batch.importedById ?? undefined,
            metadata: { importBatchId: batchId, personId: result.personId },
          });
        } else {
          const entityType = inferEntityType(batch.sourceType, fields);
          const entityData = this.buildEntityData(
            entityType,
            fields,
            rawData,
            mapping,
            sourceOrigin,
            batchId
          );
          const entity = await this.createEntityFromStaging(entityData);
          primaryEntityId = entity.id;
          await auditService.log({
            action: 'CREATE',
            entityType: entity.entityType,
            entityId: entity.id,
            entityLabel: entity.displayName,
            userId: batch.importedById ?? undefined,
            metadata: { importBatchId: batchId },
          });
        }

        await importRepository.updateStagingRow(row.id, {
          status: 'IMPORTED',
          matchedEntityId: primaryEntityId,
          processedAt: new Date(),
        });

        importedInBatch++;
      } catch (err) {
        logger.warn(`Error importando fila ${row.rowNumber}`, {
          batchId,
          rowId: row.id,
          error: err instanceof Error ? err.message : 'Error desconocido',
        });

        await importRepository.updateStagingRow(row.id, {
          status: 'ERROR',
          validationErrors: {
            import: [err instanceof Error ? err.message : 'Error al crear entidad'],
          },
          processedAt: new Date(),
        });

        errorsInBatch++;
      }
    }

    await sleep(rowBatchDelayMs);

    const remaining = await importRepository.countStagingByStatus(batchId, 'VALID');
    const updatedBatch = await importRepository.refreshBatchStats(batchId);

    if (remaining === 0) {
      await importRepository.updateBatch(batchId, {
        status: 'COMPLETED',
        completedAt: new Date(),
      });

      logger.info('Importación completada', {
        batchId,
        imported: updatedBatch.importedRows,
      });
    }

    return {
      batchId,
      status: remaining === 0 ? 'COMPLETED' : 'IMPORTING',
      processedInBatch: chunk.length,
      remaining,
      importedTotal: updatedBatch.importedRows,
      errorTotal: await importRepository.countStagingByStatus(batchId, 'ERROR'),
      done: remaining === 0,
    };
  },

  /**
   * Reintenta el procesamiento sin re-subir el archivo.
   * Limpia staging rows + resetea el batch y vuelve a ejecutar `process()`.
   */
  async retryProcess(batchId: string) {
    const batch = await importRepository.findBatchById(batchId);
    if (!batch) throw new NotFoundError('Lote de importación', batchId);

    // Evitar reintentos cuando ya se importó o está importando
    if (batch.status === 'COMPLETED' || batch.status === 'IMPORTING') {
      throw new BadRequestError(
        `No se puede reintentar un lote en estado ${batch.status}.`
      );
    }

    // Solo permitir reintento cuando tiene sentido operacionalmente
    const allowed: ImportStatus[] = ['PENDING', 'REVIEW_REQUIRED', 'FAILED', 'CANCELLED'];
    if (!allowed.includes(batch.status)) {
      throw new BadRequestError(
        `No se puede reintentar un lote en estado ${batch.status}. Estados permitidos: ${allowed.join(', ')}`
      );
    }

    await importRepository.resetBatchForRetry(batchId);
    return importRepository.findBatchById(batchId);
  },

  // ═══════════════════════════════════════════════════════════════
  // STAGING ROWS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Listado paginado de filas staging de un lote.
   */
  async listStagingRows(batchId: string, filters: StagingQueryInput) {
    const batch = await importRepository.findBatchById(batchId);
    if (!batch) throw new NotFoundError('Lote de importación', batchId);

    const result = await importRepository.findStagingRows(batchId, filters);
    return {
      data: result.data,
      meta: buildPaginationMeta(result.total, result.page, result.limit),
    };
  },

  /**
   * Detalle de una fila staging.
   */
  async getStagingRow(batchId: string, rowId: string) {
    const batch = await importRepository.findBatchById(batchId);
    if (!batch) throw new NotFoundError('Lote de importación', batchId);

    const row = await importRepository.findStagingRowById(rowId);
    if (!row || row.importBatchId !== batchId) {
      throw new NotFoundError('Fila de staging', rowId);
    }

    return row;
  },

  /**
   * Resolver una fila staging manualmente (approve / skip / link).
   */
  async resolveRow(batchId: string, rowId: string, input: ResolveRowInput) {
    const batch = await importRepository.findBatchById(batchId);
    if (!batch) throw new NotFoundError('Lote de importación', batchId);

    if (batch.status !== 'REVIEW_REQUIRED') {
      throw new BadRequestError(
        `No se pueden resolver filas en estado ${batch.status}. El lote debe estar en REVIEW_REQUIRED.`
      );
    }

    const row = await importRepository.findStagingRowById(rowId);
    if (!row || row.importBatchId !== batchId) {
      throw new NotFoundError('Fila de staging', rowId);
    }

    switch (input.action) {
      case 'approve':
        return importRepository.updateStagingRow(rowId, {
          status: 'VALID',
          processedAt: new Date(),
        });

      case 'skip':
        return importRepository.updateStagingRow(rowId, {
          status: 'SKIPPED',
          processedAt: new Date(),
        });

      case 'link':
        if (!input.linkedEntityId) {
          throw new BadRequestError('linkedEntityId es requerido para la acción "link"');
        }
        return importRepository.updateStagingRow(rowId, {
          status: 'DUPLICATE_EXACT',
          matchedEntityId: input.linkedEntityId,
          matchScore: 1.0,
          matchReason: 'vinculacion_manual',
          processedAt: new Date(),
        });

      default:
        throw new BadRequestError(`Acción no válida: ${input.action}`);
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // IMPORTACION FINAL
  // ═══════════════════════════════════════════════════════════════

  /**
   * Importa las filas VALID creando entidades reales (por lotes con pausa).
   */
  async executeImport(batchId: string) {
    let progress = await this.runExecuteBatch(batchId);
    while (!progress.done) {
      progress = await this.runExecuteBatch(batchId);
    }
    return importRepository.findBatchById(batchId);
  },

  /**
   * Cancela un lote de importacion.
   */
  async cancelBatch(batchId: string) {
    const batch = await importRepository.findBatchById(batchId);
    if (!batch) throw new NotFoundError('Lote de importación', batchId);

    if (batch.status === 'COMPLETED' || batch.status === 'CANCELLED') {
      throw new BadRequestError(`No se puede cancelar un lote en estado ${batch.status}`);
    }

    return importRepository.updateBatch(batchId, {
      status: 'CANCELLED',
      completedAt: new Date(),
    });
  },

  /**
   * Elimina un lote y todos sus staging rows (solo si PENDING, CANCELLED o FAILED).
   */
  async deleteBatch(batchId: string) {
    const batch = await importRepository.findBatchById(batchId);
    if (!batch) throw new NotFoundError('Lote de importación', batchId);

    const deletableStatuses: ImportStatus[] = ['PENDING', 'CANCELLED', 'FAILED'];
    if (!deletableStatuses.includes(batch.status)) {
      throw new BadRequestError(
        `No se puede eliminar un lote en estado ${batch.status}. Solo: ${deletableStatuses.join(', ')}`
      );
    }

    await importRepository.deleteBatch(batchId);
  },

  // ═══════════════════════════════════════════════════════════════
  // HELPERS INTERNOS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Construye StagingToEntityData desde los datos de staging.
   */
  buildEntityData(
    entityType: 'PERSON' | 'COMPANY',
    fields: ExtractedFields,
    rawData: Record<string, unknown>,
    mapping: ColumnMapping,
    sourceOrigin: string,
    importBatchId: string
  ): StagingToEntityData {
    const displayName = buildDisplayName(entityType, fields, rawData, mapping);

    // Helper para obtener valor de un campo mapeado
    const get = (field: string): string | undefined => {
      const col = mapping[field];
      if (!col) return undefined;
      const val = rawData[col];
      return val !== null && val !== undefined ? String(val).trim() || undefined : undefined;
    };

    const base: StagingToEntityData = {
      entityType,
      displayName,
      province: get('province'),
      district: get('district'),
      corregimiento: get('corregimiento'),
      address: get('address'),
      sourceOrigin,
      importBatchId,
      contacts: [],
    };

    // Agregar contactos
    if (fields.extractedEmail) {
      base.contacts!.push({ contactType: 'EMAIL', contactValue: fields.extractedEmail });
    }
    if (fields.extractedPhone) {
      const phoneCol = mapping['phone'] ? 'PHONE' : mapping['mobile'] ? 'MOBILE' : 'PHONE';
      base.contacts!.push({ contactType: phoneCol, contactValue: fields.extractedPhone });
    }
    const whatsapp = get('whatsapp');
    if (whatsapp) {
      base.contacts!.push({ contactType: 'WHATSAPP', contactValue: whatsapp });
    }
    const website = get('website');
    if (website) {
      base.contacts!.push({ contactType: 'WEBSITE', contactValue: website });
    }

    // Datos especificos por tipo
    switch (entityType) {
      case 'PERSON':
        base.person = {
          firstName: fields.extractedFirstName || 'Sin nombre',
          lastName: fields.extractedLastName || 'Sin apellido',
          secondLastName: get('secondLastName'),
          cedula: fields.extractedCedula,
          gender: normalizeGender(get('gender')) as any,
          birthDate: get('birthDate'),
          nationalityCode: resolveNationalityCode(get('nationality')),
          educationLevel: get('educationLevel'),
          occupation: get('occupation'),
          businessName: fields.extractedBusinessName,
        };
        break;

      case 'COMPANY':
        base.company = {
          legalName: get('legalName') || fields.extractedBusinessName || 'Empresa sin nombre',
          ruc: fields.extractedRuc,
          dv: get('dv'),
          tradeName: get('tradeName'),
          companyType: get('companyType'),
        };
        break;
    }

    return base;
  },

  async importUnificadaRow(
    fields: ExtractedFields,
    rawData: Record<string, unknown>,
    mapping: ColumnMapping,
    sourceOrigin: string,
    importBatchId: string,
    createdById?: string
  ): Promise<{ personId: string; companyId: string; personName: string; companyName: string }> {
    const get = (field: string): string | undefined => {
      const col = mapping[field];
      if (!col) return undefined;
      const val = rawData[col];
      return val !== null && val !== undefined ? String(val).trim() || undefined : undefined;
    };

    const loc = locationInputToCodes({
      province: get('province'),
      district: get('district'),
      corregimiento: get('corregimiento'),
    });
    const address = get('address');

    const contacts: Array<{ contactType: string; contactValue: string }> = [];
    if (fields.extractedEmail) {
      contacts.push({ contactType: 'EMAIL', contactValue: fields.extractedEmail });
    }
    if (fields.extractedPhone) {
      contacts.push({ contactType: 'PHONE', contactValue: fields.extractedPhone });
    }

    const personName = [fields.extractedFirstName, fields.extractedLastName].filter(Boolean).join(' ');
    const companyLegalName =
      get('legalName') || fields.extractedBusinessName || `Empresa de ${personName}`;

    return prisma.$transaction(async (tx) => {
      let personEntity = fields.extractedCedula
        ? await tx.entity.findFirst({
            where: {
              entityType: 'PERSON',
              status: { not: 'MERGED' },
              person: { cedula: fields.extractedCedula },
            },
            include: { person: true },
          })
        : null;

      if (!personEntity) {
        personEntity = await tx.entity.create({
          data: {
            entityType: 'PERSON',
            status: 'ACTIVE',
            displayName: personName || 'Sin nombre',
            province: loc.province,
            district: loc.district,
            corregimiento: loc.corregimiento,
            address,
            sourceOrigin,
            importBatchId,
            createdById,
            person: {
              create: {
                firstName: fields.extractedFirstName || 'Sin nombre',
                lastName: fields.extractedLastName || 'Sin apellido',
                cedula: fields.extractedCedula,
              },
            },
            contacts: contacts.length
              ? { create: contacts as Prisma.EntityContactCreateWithoutEntityInput[] }
              : undefined,
          },
          include: { person: true },
        });
      }

      let companyEntity = fields.extractedRuc
        ? await tx.entity.findFirst({
            where: {
              entityType: 'COMPANY',
              status: { not: 'MERGED' },
              company: { ruc: fields.extractedRuc },
            },
            include: { company: true },
          })
        : null;

      if (!companyEntity) {
        companyEntity = await tx.entity.create({
          data: {
            entityType: 'COMPANY',
            status: 'ACTIVE',
            displayName: companyLegalName,
            province: loc.province,
            district: loc.district,
            corregimiento: loc.corregimiento,
            address,
            sourceOrigin,
            importBatchId,
            createdById,
            company: {
              create: {
                legalName: companyLegalName,
                ruc: fields.extractedRuc,
              },
            },
          },
          include: { company: true },
        });
      }

      const existingRel = await tx.entityRelationship.findFirst({
        where: {
          OR: [
            { fromEntityId: personEntity.id, toEntityId: companyEntity.id },
            { fromEntityId: companyEntity.id, toEntityId: personEntity.id },
          ],
        },
      });

      if (!existingRel) {
        await tx.entityRelationship.create({
          data: {
            fromEntityId: personEntity.id,
            toEntityId: companyEntity.id,
            relationshipType: 'OWNER',
            isActive: true,
          },
        });
      }

      return {
        personId: personEntity.id,
        companyId: companyEntity.id,
        personName: personEntity.displayName,
        companyName: companyEntity.displayName,
      };
    });
  },

  /**
   * Crea una entidad en la base de datos desde StagingToEntityData.
   * Usa transaccion Prisma para crear entity + subtipo + contactos.
   */
  async createEntityFromStaging(data: StagingToEntityData) {
    const loc = locationInputToCodes(data);
    return prisma.entity.create({
      data: {
        entityType: data.entityType as EntityType,
        status: 'ACTIVE',
        displayName: data.displayName,
        province: loc.province,
        district: loc.district,
        corregimiento: loc.corregimiento,
        address: data.address,
        sourceOrigin: data.sourceOrigin,
        importBatchId: data.importBatchId,

        // Subtipo persona
        person: data.person
          ? {
              create: {
                firstName: data.person.firstName,
                lastName: data.person.lastName,
                secondLastName: data.person.secondLastName,
                cedula: data.person.cedula,
                gender: data.person.gender as Gender | null | undefined,
                birthDate: data.person.birthDate ? new Date(data.person.birthDate) : undefined,
                nationalityCode: resolveNationalityCode(data.person.nationalityCode),
                educationLevel: data.person.educationLevel,
                occupation: data.person.occupation,
                businessName: data.person.businessName,
              },
            }
          : undefined,

        company: data.company
          ? {
              create: {
                legalName: data.company.legalName,
                ruc: data.company.ruc,
                dv: data.company.dv,
                tradeName: data.company.tradeName,
                companyType: data.company.companyType,
              },
            }
          : undefined,

        contacts: data.contacts && data.contacts.length > 0
          ? {
              create: data.contacts.map((c) => ({
                contactType: c.contactType as any,
                contactValue: c.contactValue,
                label: c.label,
              })),
            }
          : undefined,
      },
      select: { id: true, displayName: true, entityType: true },
    });
  },

  /**
   * Obtiene campos del sistema disponibles para mapear.
   */
  getSystemFields() {
    return getAvailableSystemFields();
  },
};

registerImportProcessRunner((batchId) => importService.runBackgroundProcess(batchId));
