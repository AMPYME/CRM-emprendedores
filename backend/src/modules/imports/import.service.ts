/**
 * Servicio principal del modulo de importaciones.
 *
 * Flujo completo:
 * 1. Upload   → Multer guarda archivo, se crea ImportBatch (PENDING)
 * 2. Preview  → Se parsean headers + primeras N filas, se sugiere mapeo
 * 3. Mapping  → El usuario confirma/ajusta el mapeo de columnas
 * 4. Process  → Se parsea todo el Excel, se crea StagingRows con campos extraidos,
 *               se valida y se ejecuta deduplicacion
 * 5. Review   → El usuario revisa filas DUPLICATE_POSSIBLE / INVALID
 * 6. Import   → Se crean entidades desde filas VALID
 * 7. Complete → Se actualizan estadisticas y se marca COMPLETED
 */
import path from 'path';
import { ImportStatus, StagingRowStatus, EntityType, Prisma, Gender } from '@prisma/client';
import { prisma } from '../../config/database';
import { importRepository, BatchWithRelations, StagingRowWithRelations } from './import.repository';
import { parseExcelFile, getExcelHeaders, getExcelPreview } from './parser.service';
import { buildMapping, applyMapping, getAvailableSystemFields, inferEntityType } from './mapper.service';
import { deduplicateRow } from './dedup.service';
import { StagingToEntityData, ColumnMapping, ExtractedFields, ValidationResult } from './import.types';
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
  entityType: 'PERSON' | 'COMPANY' | 'ESTABLISHMENT',
  fields: ExtractedFields,
  rawData: Record<string, unknown>,
  mapping: ColumnMapping
): string {
  switch (entityType) {
    case 'PERSON': {
      const parts = [
        fields.extractedFirstName,
        fields.extractedLastName,
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(' ') : 'Sin nombre';
    }
    case 'COMPANY': {
      const legalNameCol = mapping['legalName'];
      const legalName = legalNameCol ? String(rawData[legalNameCol] || '') : '';
      return fields.extractedBusinessName || legalName || 'Empresa sin nombre';
    }
    case 'ESTABLISHMENT': {
      return fields.extractedBusinessName || 'Establecimiento sin nombre';
    }
  }
}

/**
 * Validacion basica de una fila de staging.
 * Verifica campos obligatorios segun el tipo de entidad.
 */
function validateRow(
  entityType: 'PERSON' | 'COMPANY' | 'ESTABLISHMENT',
  fields: ExtractedFields
): ValidationResult {
  const errors: string[] = [];

  switch (entityType) {
    case 'PERSON':
      if (!fields.extractedFirstName) errors.push('Nombre es requerido');
      if (!fields.extractedLastName) errors.push('Apellido es requerido');
      break;
    case 'COMPANY':
      if (!fields.extractedBusinessName) errors.push('Nombre de empresa es requerido');
      break;
    case 'ESTABLISHMENT':
      if (!fields.extractedBusinessName) errors.push('Nombre de establecimiento es requerido');
      break;
  }

  return { isValid: errors.length === 0, errors };
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

    return { ...batch, stagingStats: stats };
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
    const headers = getExcelHeaders(filePath);

    if (headers.length === 0) {
      throw new BadRequestError('El archivo Excel no contiene columnas válidas');
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

    const filePath = path.resolve(config.uploadDir, batch.fileName);
    const previewData = getExcelPreview(filePath, maxRows);

    const currentMapping = (batch.columnMapping as ColumnMapping) || {};

    return {
      batchId: batch.id,
      fileName: batch.originalFileName,
      sourceType: batch.sourceType,
      headers: previewData.headers,
      sampleRows: previewData.rows,
      totalPreviewRows: previewData.totalRows,
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

    if (batch.status !== 'PENDING' && batch.status !== 'REVIEW_REQUIRED') {
      throw new BadRequestError(
        `No se puede modificar el mapeo en estado ${batch.status}. Solo PENDING o REVIEW_REQUIRED.`
      );
    }

    const updated = await importRepository.updateBatch(batchId, {
      columnMapping: columnMapping as any,
    });

    return updated;
  },

  // ═══════════════════════════════════════════════════════════════
  // PROCESAMIENTO
  // ═══════════════════════════════════════════════════════════════

  /**
   * Procesa el Excel completo: parseo → staging → validación → deduplicación.
   * Cambia status: PENDING → PROCESSING → VALIDATING → DEDUPLICATING → REVIEW_REQUIRED
   */
  async process(batchId: string) {
    const batch = await importRepository.findBatchById(batchId);
    if (!batch) throw new NotFoundError('Lote de importación', batchId);

    if (batch.status !== 'PENDING' && batch.status !== 'REVIEW_REQUIRED') {
      throw new BadRequestError(
        `No se puede procesar un lote en estado ${batch.status}. Solo PENDING o REVIEW_REQUIRED.`
      );
    }

    const mapping = (batch.columnMapping as ColumnMapping) || {};
    if (Object.keys(mapping).length === 0) {
      throw new BadRequestError(
        'Debe configurar el mapeo de columnas antes de procesar. Use PUT /imports/:id/mapping'
      );
    }

    // ── PASO 1: Marcar como PROCESSING ──────────────────────
    await importRepository.updateBatch(batchId, {
      status: 'PROCESSING',
      startedAt: new Date(),
    });

    try {
      // ── PASO 2: Parsear Excel completo ──────────────────────
      const filePath = path.resolve(config.uploadDir, batch.fileName);
      const parsed = parseExcelFile(filePath);

      logger.info(`Parseadas ${parsed.totalRows} filas del Excel`, { batchId });

      // ── PASO 3: Crear staging rows con campos extraidos ─────
      await importRepository.updateBatch(batchId, { status: 'VALIDATING' });

      const stagingData = parsed.rows.map((rawRow, index) => {
        const fields = applyMapping(rawRow, mapping);
        return {
          importBatchId: batchId,
          rowNumber: index + 1,
          rawData: rawRow,
          ...fields,
        };
      });

      // Bulk insert en lotes de 500
      const BATCH_SIZE = 500;
      let insertedCount = 0;
      for (let i = 0; i < stagingData.length; i += BATCH_SIZE) {
        const chunk = stagingData.slice(i, i + BATCH_SIZE);
        const count = await importRepository.createManyStagingRows(chunk);
        insertedCount += count;
      }

      logger.info(`${insertedCount} staging rows creados`, { batchId });

      // ── PASO 4: Validar filas ───────────────────────────────
      const pendingRows = await importRepository.findPendingStagingRows(batchId);

      for (const row of pendingRows) {
        const fields: ExtractedFields = {
          extractedCedula: row.extractedCedula || undefined,
          extractedRuc: row.extractedRuc || undefined,
          extractedFirstName: row.extractedFirstName || undefined,
          extractedLastName: row.extractedLastName || undefined,
          extractedEmail: row.extractedEmail || undefined,
          extractedPhone: row.extractedPhone || undefined,
          extractedBusinessName: row.extractedBusinessName || undefined,
        };

        const entityType = inferEntityType(batch.sourceType, fields);
        const validation = validateRow(entityType, fields);

        if (!validation.isValid) {
          await importRepository.updateStagingRow(row.id, {
            status: 'INVALID',
            validationErrors: { general: validation.errors },
            processedAt: new Date(),
          });
          continue;
        }

        // Marcar como VALID temporalmente (se refinara con dedup)
        await importRepository.updateStagingRow(row.id, {
          status: 'VALID',
          processedAt: new Date(),
        });
      }

      // ── PASO 5: Deduplicar filas validas ────────────────────
      await importRepository.updateBatch(batchId, { status: 'DEDUPLICATING' });

      const validRows = await importRepository.findValidStagingRows(batchId);

      for (const row of validRows) {
        const fields: ExtractedFields = {
          extractedCedula: row.extractedCedula || undefined,
          extractedRuc: row.extractedRuc || undefined,
          extractedFirstName: row.extractedFirstName || undefined,
          extractedLastName: row.extractedLastName || undefined,
          extractedEmail: row.extractedEmail || undefined,
          extractedPhone: row.extractedPhone || undefined,
          extractedBusinessName: row.extractedBusinessName || undefined,
        };

        const dedupResult = await deduplicateRow(row.id, fields);

        if (dedupResult.bestMatch) {
          const isExact = dedupResult.bestMatch.score >= 1.0;
          await importRepository.updateStagingRow(row.id, {
            status: isExact ? 'DUPLICATE_EXACT' : 'DUPLICATE_POSSIBLE',
            matchedEntityId: dedupResult.bestMatch.entityId,
            matchScore: dedupResult.bestMatch.score,
            matchReason: dedupResult.bestMatch.reason,
          });
        }
        // Si no hay match, se queda VALID (listo para importar)
      }

      // ── PASO 6: Actualizar estadisticas y marcar REVIEW_REQUIRED ──
      const updatedBatch = await importRepository.refreshBatchStats(batchId);

      // Determinar estado final del procesamiento
      const hasReviewItems =
        (updatedBatch.duplicateRows > 0) || (updatedBatch.invalidRows > 0);

      await importRepository.updateBatch(batchId, {
        status: hasReviewItems ? 'REVIEW_REQUIRED' : 'REVIEW_REQUIRED',
        // Siempre REVIEW_REQUIRED para que el usuario confirme antes de importar
      });

      const finalBatch = await importRepository.findBatchById(batchId);

      logger.info('Procesamiento completado', {
        batchId,
        total: updatedBatch.totalRows,
        valid: updatedBatch.validRows,
        invalid: updatedBatch.invalidRows,
        duplicates: updatedBatch.duplicateRows,
      });

      return finalBatch;
    } catch (error) {
      // Marcar como FAILED si hay error
      await importRepository.updateBatch(batchId, {
        status: 'FAILED',
        errorLog: {
          message: error instanceof Error ? error.message : 'Error desconocido',
          timestamp: new Date().toISOString(),
        } as any,
        completedAt: new Date(),
      });
      throw error;
    }
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
    return this.process(batchId);
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
   * Importa las filas VALID creando entidades reales.
   * Cambia status: REVIEW_REQUIRED → IMPORTING → COMPLETED
   */
  async executeImport(batchId: string) {
    const batch = await importRepository.findBatchById(batchId);
    if (!batch) throw new NotFoundError('Lote de importación', batchId);

    if (batch.status !== 'REVIEW_REQUIRED') {
      throw new BadRequestError(
        `No se puede importar en estado ${batch.status}. El lote debe estar en REVIEW_REQUIRED.`
      );
    }

    await importRepository.updateBatch(batchId, { status: 'IMPORTING' });

    try {
      const mapping = (batch.columnMapping as ColumnMapping) || {};
      const validRows = await importRepository.findValidStagingRows(batchId);

      if (validRows.length === 0) {
        throw new BadRequestError('No hay filas válidas para importar');
      }

      let importedCount = 0;
      let errorCount = 0;
      const sourceOrigin = `IMPORT_${batch.sourceType}_${batch.id.substring(0, 8)}`;

      for (const row of validRows) {
        try {
          const rawData = row.rawData as Record<string, unknown>;
          const fields: ExtractedFields = {
            extractedCedula: row.extractedCedula || undefined,
            extractedRuc: row.extractedRuc || undefined,
            extractedFirstName: row.extractedFirstName || undefined,
            extractedLastName: row.extractedLastName || undefined,
            extractedEmail: row.extractedEmail || undefined,
            extractedPhone: row.extractedPhone || undefined,
            extractedBusinessName: row.extractedBusinessName || undefined,
          };

          const entityType = inferEntityType(batch.sourceType, fields);
          const entityData = this.buildEntityData(entityType, fields, rawData, mapping, sourceOrigin, batchId);

          // Crear entidad en transaccion
          const entity = await this.createEntityFromStaging(entityData);

          // Marcar staging row como IMPORTED
          await importRepository.updateStagingRow(row.id, {
            status: 'IMPORTED',
            matchedEntityId: entity.id,
            processedAt: new Date(),
          });

          importedCount++;
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

          errorCount++;
        }
      }

      // Actualizar estadisticas finales
      await importRepository.refreshBatchStats(batchId);
      await importRepository.updateBatch(batchId, {
        status: 'COMPLETED',
        completedAt: new Date(),
      });

      const finalBatch = await importRepository.findBatchById(batchId);

      logger.info('Importación completada', {
        batchId,
        imported: importedCount,
        errors: errorCount,
      });

      return finalBatch;
    } catch (error) {
      await importRepository.updateBatch(batchId, {
        status: 'FAILED',
        errorLog: {
          message: error instanceof Error ? error.message : 'Error desconocido',
          phase: 'import',
          timestamp: new Date().toISOString(),
        } as any,
        completedAt: new Date(),
      });
      throw error;
    }
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
    entityType: 'PERSON' | 'COMPANY' | 'ESTABLISHMENT',
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
          economicActivity: get('economicActivity'),
        };
        break;

      case 'COMPANY':
        base.company = {
          legalName: get('legalName') || fields.extractedBusinessName || 'Empresa sin nombre',
          ruc: fields.extractedRuc,
          dv: get('dv'),
          tradeName: get('tradeName'),
          companyType: get('companyType'),
          economicActivity: get('economicActivity'),
          employeeCount: get('employeeCount') ? parseInt(get('employeeCount')!, 10) || undefined : undefined,
        };
        break;

      case 'ESTABLISHMENT':
        base.establishment = {
          establishmentName: fields.extractedBusinessName || 'Establecimiento sin nombre',
          establishmentType: get('establishmentType'),
          economicActivity: get('economicActivity'),
          noticeOfOperation: get('noticeOfOperation'),
        };
        break;
    }

    return base;
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
                gender: data.person.gender as any,
                birthDate: data.person.birthDate ? new Date(data.person.birthDate) : undefined,
                nationalityCode: resolveNationalityCode(data.person.nationalityCode),
                educationLevel: data.person.educationLevel,
                occupation: data.person.occupation,
                businessName: data.person.businessName,
                economicActivity: data.person.economicActivity,
              },
            }
          : undefined,

        // Subtipo empresa
        company: data.company
          ? {
              create: {
                legalName: data.company.legalName,
                ruc: data.company.ruc,
                dv: data.company.dv,
                tradeName: data.company.tradeName,
                companyType: data.company.companyType,
                economicActivity: data.company.economicActivity,
                employeeCount: data.company.employeeCount,
              },
            }
          : undefined,

        // Subtipo establecimiento
        establishment: data.establishment
          ? {
              create: {
                establishmentName: data.establishment.establishmentName,
                establishmentType: data.establishment.establishmentType,
                economicActivity: data.establishment.economicActivity,
                noticeOfOperation: data.establishment.noticeOfOperation,
              },
            }
          : undefined,

        // Contactos
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
