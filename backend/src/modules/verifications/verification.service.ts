import { randomUUID } from 'crypto';
import { prisma } from '../../config/database';
import { verificationRepository } from './verification.repository';
import { verificationQuerySchema, type VerificationQueryInput, type RejectVerificationInput } from './verification.validator';
import type { VerificationDataPayload, VerificationListItem, VerificationClaimResult, VerificationValidateResult } from './verification.types';
import { stagingRowToVerificationCreateInput } from './verification.mapper';
import { importRepository } from '../imports/import.repository';
import { importService } from '../imports/import.service';
import { isUnifiedCsvSource } from '../imports/mapper.service';
import { intakeRepository } from '../intake/intake.repository';
import { seedIntakeFromVerificationPayload } from '../intake/intake.writer';
import { intakeService } from '../intake/intake.service';
import { auditService } from '../audit/audit.service';
import { PaginationMeta } from '../../shared/types/api-response.types';
import {
  AppError,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/app-error';
import { logger } from '../../shared/logger/logger';
import { locationInputToCodes } from '../../shared/utils/division-politica';
import { getImportBatchSettings, sleep } from '../imports/import-batch.util';
import { persistProgress, readErrorLog } from '../imports/import-progress.util';
import { intakeWs } from '../intake/intake.ws';
import {
  IMPORT_VERIFICATION_INACTIVITY_TTL_MIN,
  ttlMinutesForVerificationSource,
} from '../intake/intake-ttl';

function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
}

function mapListItem(row: Awaited<ReturnType<typeof verificationRepository.findById>>): VerificationListItem {
  if (!row) throw new NotFoundError('Registro de verificación');
  return {
    id: row.id,
    entityType: row.entityType,
    source: row.source,
    status: row.status,
    displayName: row.displayName,
    searchCedula: row.searchCedula,
    searchRuc: row.searchRuc,
    province: row.province,
    district: row.district,
    corregimiento: row.corregimiento,
    importBatchId: row.importBatchId,
    importFileName: row.importBatch?.originalFileName ?? null,
    stagingRowId: row.stagingRowId,
    assignedToId: row.assignedToId,
    assignedToName: row.assignedTo
      ? `${row.assignedTo.firstName} ${row.assignedTo.lastName}`
      : null,
    assignedAt: row.assignedAt?.toISOString() ?? null,
    assignmentExpiresAt:
      row.source === 'IMPORT'
        ? (row.intakeSession?.expiresAt?.toISOString()
          ?? (row.assignedAt
            ? new Date(
                row.assignedAt.getTime() + IMPORT_VERIFICATION_INACTIVITY_TTL_MIN * 60 * 1000
              ).toISOString()
            : null))
        : row.intakeSession?.expiresAt?.toISOString() ?? null,
    intakeSessionId: row.intakeSessionId,
    validatedEntityId: row.validatedEntityId,
    validatedAt: row.validatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const verificationService = {
  async list(filters: VerificationQueryInput, currentUserId?: string) {
    const parsed = verificationQuerySchema.parse(filters);
    const result = await verificationRepository.findAll(parsed, currentUserId);
    return {
      data: result.data.map((r) => mapListItem(r)),
      meta: buildPaginationMeta(result.total, result.page, result.limit),
    };
  },

  async getById(id: string) {
    const row = await verificationRepository.findById(id);
    if (!row) throw new NotFoundError('Registro de verificación', id);
    return mapListItem(row);
  },

  async getDetail(id: string) {
    const row = await verificationRepository.findById(id);
    if (!row) throw new NotFoundError('Registro de verificación', id);
    return {
      ...mapListItem(row),
      data: row.data as unknown as VerificationDataPayload,
    };
  },

  /**
   * Envía un lote de filas VALID a la cola de verificación.
   */
  async runVerificationBatch(batchId: string, userId?: string) {
    const batch = await importRepository.findBatchById(batchId);
    if (!batch) throw new NotFoundError('Lote de importación', batchId);

    if (batch.status !== 'REVIEW_REQUIRED' && batch.status !== 'IMPORTING') {
      throw new BadRequestError(
        `No se puede enviar a verificación en estado ${batch.status}.`
      );
    }

    const mapping = (batch.columnMapping as Record<string, string>) || {};
    const { rowBatchSize, rowBatchDelayMs } = getImportBatchSettings();

    if (batch.status === 'REVIEW_REQUIRED') {
      const validCount = await importRepository.countStagingByStatus(batchId, 'VALID');
      if (validCount === 0) {
        throw new BadRequestError('No hay filas válidas para enviar a verificación');
      }
      await persistProgress(batchId, {
        processed: 0,
        total: validCount,
        message: `Enviando ${validCount.toLocaleString('es-PA')} registros a verificación…`,
        phase: 'verification',
        status: 'IMPORTING',
      });
    }

    const validRows = await importRepository.findValidStagingRows(batchId);
    const chunk = validRows.slice(0, rowBatchSize);

    if (chunk.length === 0) {
      await importRepository.refreshBatchStats(batchId);
      await persistProgress(batchId, {
        processed: readErrorLog(batch.errorLog).progress?.total || 0,
        total: readErrorLog(batch.errorLog).progress?.total || 0,
        message: 'Enviado a cola de verificación',
        phase: 'done',
        status: 'VERIFICATION_QUEUED',
      });
      await importRepository.updateBatch(batchId, {
        completedAt: new Date(),
      });
      intakeWs.notifyQueueChanged('verification_queued');

      return {
        batchId,
        queued: 0,
        processedInBatch: 0,
        remaining: 0,
        done: true,
        logs: [],
      };
    }

    const items = chunk.map((row) =>
      stagingRowToVerificationCreateInput({
        row,
        importBatchId: batchId,
        sourceType: batch.sourceType,
        mapping,
      })
    );
    const result = await verificationRepository.createMany(items);

    await prisma.stagingRow.updateMany({
      where: { id: { in: chunk.map((r) => r.id) } },
      data: { status: 'QUEUED_FOR_VERIFICATION', processedAt: new Date() },
    });

    const logs = chunk.map((row, i) => {
      const item = items[i];
      const payload = item.data as unknown as VerificationDataPayload;
      const both = !!(payload.snapshot?.person && payload.snapshot?.company);
      return {
        at: new Date().toISOString(),
        rowNumber: row.rowNumber,
        name: item.displayName || 'Sin nombre',
        entityType: both ? 'BOTH' : String(item.entityType),
        cedula: item.searchCedula ?? null,
        ruc: item.searchRuc ?? null,
        message: both
          ? 'Enviado a intake (persona + empresa)'
          : `Enviado a intake (${item.entityType === 'COMPANY' ? 'empresa' : 'persona'})`,
      };
    });

    await sleep(rowBatchDelayMs);

    const remaining = (await importRepository.findValidStagingRows(batchId)).length;
    const alreadyQueued = await prisma.verificationItem.count({
      where: { importBatchId: batchId, source: 'IMPORT' },
    });
    const total = alreadyQueued + remaining;

    if (remaining === 0) {
      await importRepository.refreshBatchStats(batchId);
      await persistProgress(batchId, {
        processed: alreadyQueued,
        total,
        message: 'Enviado a cola de verificación',
        phase: 'done',
        status: 'VERIFICATION_QUEUED',
        appendVerificationLogs: logs,
      });
      await importRepository.updateBatch(batchId, {
        completedAt: new Date(),
      });

      await auditService.log({
        action: 'VERIFICATION_UPDATE',
        entityType: 'IMPORT_BATCH',
        entityId: batchId,
        entityLabel: batch.originalFileName,
        userId,
        metadata: { queued: result.count, action: 'send_to_verification' },
      });

      logger.info('Importación enviada a cola de verificación', { batchId, queued: result.count });
      intakeWs.notifyQueueChanged('verification_queued');
    } else {
      await persistProgress(batchId, {
        processed: alreadyQueued,
        total,
        message: `Enviando a verificación (${remaining.toLocaleString('es-PA')} pendientes)…`,
        phase: 'verification',
        status: 'IMPORTING',
        appendVerificationLogs: logs,
      });
      intakeWs.notifyQueueChanged('verification_batch');
    }

    return {
      batchId,
      queued: result.count,
      processedInBatch: chunk.length,
      remaining,
      done: remaining === 0,
      logs,
    };
  },

  /**
   * Convierte filas VALID de un lote de importación en registros de cola (por lotes).
   */
  async sendImportToVerification(batchId: string, userId?: string) {
    const batch = await importRepository.findBatchById(batchId);
    if (!batch) throw new NotFoundError('Lote de importación', batchId);

    if (batch.status !== 'REVIEW_REQUIRED') {
      throw new BadRequestError(
        `No se puede enviar a verificación en estado ${batch.status}. El lote debe estar en REVIEW_REQUIRED.`
      );
    }

    try {
      let totalQueued = 0;
      let progress = await this.runVerificationBatch(batchId, userId);
      totalQueued += progress.queued;

      while (!progress.done) {
        progress = await this.runVerificationBatch(batchId, userId);
        totalQueued += progress.queued;
      }

      return { batchId, queued: totalQueued };
    } catch (error) {
      await importRepository.updateBatch(batchId, { status: 'FAILED' });
      throw error;
    }
  },

  /**
   * Claim atómico + creación de sesión intake bajo demanda.
   */
  async claim(id: string, userId: string, userEmail?: string): Promise<VerificationClaimResult> {
    const item = await verificationRepository.findById(id);
    if (!item) throw new NotFoundError('Registro de verificación', id);

    if (item.status === 'VALIDATED' || item.status === 'REJECTED') {
      throw new BadRequestError('Este registro ya fue procesado');
    }

    if (item.assignedToId && item.assignedToId !== userId) {
      throw new AppError(
        'Este registro ya fue asignado a otro funcionario.',
        409,
        'VERIFICATION_ALREADY_ASSIGNED'
      );
    }

    if (item.intakeSessionId) {
      const session = await intakeRepository.getSession(item.intakeSessionId);
      if (session && session.status !== 'VALIDATED' && session.status !== 'EXPIRED') {
        if (!item.assignedToId) {
          await verificationRepository.claimAtomic(id, userId);
        }
        await verificationRepository.updateStatus(id, 'IN_REVIEW');
        return {
          verificationId: id,
          intakeSessionId: item.intakeSessionId,
          accessCode: '',
          status: 'IN_REVIEW',
        };
      }
    }

    const claimResult = await verificationRepository.claimAtomic(id, userId);
    if (claimResult.count === 0 && item.assignedToId !== userId) {
      throw new AppError(
        'Este registro ya fue asignado a otro funcionario.',
        409,
        'VERIFICATION_ALREADY_ASSIGNED'
      );
    }

    const payload = item.data as unknown as VerificationDataPayload;
    const ttlMinutes = ttlMinutesForVerificationSource(item.source);
    const { session, accessCode } = await intakeRepository.createSession(
      userId,
      payload.entityType,
      ttlMinutes
    );

    await verificationRepository.linkIntakeSession(id, session.session_id, userId);

    await seedIntakeFromVerificationPayload(
      session.session_id,
      payload.entityType,
      payload.snapshot as Parameters<typeof seedIntakeFromVerificationPayload>[2]
    );

    await auditService.log({
      action: 'VERIFICATION_CLAIM',
      entityType: 'VERIFICATION',
      entityId: id,
      entityLabel: item.displayName ?? undefined,
      userId,
      userEmail,
      metadata: { intakeSessionId: session.session_id, source: item.source },
    });

    intakeWs.notifyQueueChanged('claimed');

    return {
      verificationId: id,
      intakeSessionId: session.session_id,
      accessCode,
      status: 'IN_REVIEW',
    };
  },

  async release(id: string, userId: string, userEmail?: string, options?: { force?: boolean }) {
    const item = await verificationRepository.findById(id);
    if (!item) throw new NotFoundError('Registro de verificación', id);

    if (!options?.force && item.assignedToId !== userId) {
      throw new ForbiddenError('Solo el funcionario asignado puede liberar este registro');
    }

    const result = options?.force
      ? await verificationRepository.releaseAny(id)
      : await verificationRepository.release(id, userId);
    if (result.count === 0) {
      throw new BadRequestError('No se pudo liberar el registro');
    }

    if (item.intakeSessionId) {
      await intakeRepository.deleteSession(item.intakeSessionId).catch(() => undefined);
    }

    await auditService.log({
      action: 'VERIFICATION_UPDATE',
      entityType: 'VERIFICATION',
      entityId: id,
      entityLabel: item.displayName ?? undefined,
      userId,
      userEmail,
      metadata: { action: 'release', force: !!options?.force },
    });

    intakeWs.notifyQueueChanged('released');

    return { released: true };
  },

  async releaseAll(userId: string, userEmail?: string) {
    const items = await verificationRepository.findAssignedForRelease();
    const sessionIds = items
      .map((i) => i.intakeSessionId)
      .filter((id): id is string => !!id);

    if (sessionIds.length > 0) {
      await prisma.intakeSession.deleteMany({ where: { id: { in: sessionIds } } });
    }

    const result = await verificationRepository.releaseAllAssigned();

    await auditService.log({
      action: 'VERIFICATION_UPDATE',
      entityType: 'VERIFICATION',
      entityId: userId,
      entityLabel: 'Liberar todas las asignaciones',
      userId,
      userEmail,
      metadata: { action: 'release_all', count: result.count },
    });

    intakeWs.notifyQueueChanged('released_all');

    return { released: result.count };
  },

  async validate(id: string, userId: string, userEmail?: string): Promise<VerificationValidateResult> {
    const item = await verificationRepository.findById(id);
    if (!item) throw new NotFoundError('Registro de verificación', id);

    if (item.assignedToId && item.assignedToId !== userId) {
      throw new ForbiddenError('Este registro está asignado a otro funcionario');
    }

    if (!item.intakeSessionId) {
      throw new BadRequestError('Debe abrir y revisar el registro antes de validar');
    }

    const payload = item.data as unknown as VerificationDataPayload;
    let entities: VerificationValidateResult['entities'] = [];

    // Migrar desde la sesión revisada (aplica ediciones). Si la cédula/RUC ya existe, actualiza.
    const migrateResult = await intakeService.validateAndMigrate(
      item.intakeSessionId,
      userId,
      undefined,
      userEmail,
      { skipAccessCheck: true, onDuplicate: 'update' }
    );
    entities = migrateResult.entities.map((e) => ({
      id: e.id,
      entityType: e.entityType,
      displayName: e.displayName,
    }));

    // CSV unificado: crea persona, empresa o ambas (con datos compartidos) según la fila.
    if (payload.importMeta && isUnifiedCsvSource(payload.importMeta.sourceType)) {
      const meta = payload.importMeta;
      const sourceOrigin = `IMPORT_${meta.sourceType}_${meta.importBatchId.substring(0, 8)}`;
      const hasPerson = entities.some((e) => e.entityType === 'PERSON');
      const hasCompany = entities.some((e) => e.entityType === 'COMPANY');
      const result = await importService.importUnificadaRow(
        meta.fields,
        meta.rawData,
        meta.mapping,
        sourceOrigin,
        meta.importBatchId,
        userId,
        { skipPerson: hasPerson, skipCompany: hasCompany }
      );
      const byId = new Map(entities.map((e) => [e.id, e]));
      if (result.personId) {
        byId.set(result.personId, {
          id: result.personId,
          entityType: 'PERSON',
          displayName: result.personName || 'Sin nombre',
        });
      }
      if (result.companyId) {
        byId.set(result.companyId, {
          id: result.companyId,
          entityType: 'COMPANY',
          displayName: result.companyName || 'Empresa sin nombre',
        });
      }
      entities = [...byId.values()];
    }

    await verificationRepository.updateStatus(id, 'VALIDATED', {
      validatedAt: new Date(),
      validatedEntityId: entities[0]?.id,
    });

    if (item.stagingRowId) {
      await importRepository.updateStagingRow(item.stagingRowId, {
        status: 'IMPORTED',
        matchedEntityId: entities[0]?.id,
        processedAt: new Date(),
      });
    }

    await auditService.log({
      action: 'VERIFICATION_VALIDATE',
      entityType: 'VERIFICATION',
      entityId: id,
      entityLabel: item.displayName ?? undefined,
      userId,
      userEmail,
      metadata: {
        entities,
        importBatchId: item.importBatchId,
        source: item.source,
      },
    });

    intakeWs.notifyQueueChanged('validated');

    return { verificationId: id, entities };
  },

  async reject(id: string, userId: string, input: RejectVerificationInput, userEmail?: string) {
    const item = await verificationRepository.findById(id);
    if (!item) throw new NotFoundError('Registro de verificación', id);

    if (item.assignedToId && item.assignedToId !== userId) {
      throw new ForbiddenError('Este registro está asignado a otro funcionario');
    }

    await verificationRepository.updateStatus(id, 'REJECTED', {
      rejectedAt: new Date(),
      rejectionReason: input.reason,
    });

    if (item.intakeSessionId) {
      await intakeRepository.deleteSession(item.intakeSessionId).catch(() => undefined);
    }

    await auditService.log({
      action: 'VERIFICATION_REJECT',
      entityType: 'VERIFICATION',
      entityId: id,
      entityLabel: item.displayName ?? undefined,
      userId,
      userEmail,
      metadata: { reason: input.reason, importBatchId: item.importBatchId },
    });

    intakeWs.notifyQueueChanged('rejected');

    return { rejected: true };
  },

  /** Crea registro FIELD al abrir captura en campo. */
  async createFieldVerification(params: {
    intakeSessionId: string;
    entityType: 'PERSON' | 'COMPANY';
    displayName: string;
    createdById: string;
    data: VerificationDataPayload;
  }) {
    const loc = params.data.snapshot.location;
    const codes = locationInputToCodes({
      province: loc.province ?? undefined,
      district: loc.district ?? undefined,
      corregimiento: loc.corregimiento ?? undefined,
    });

    return prisma.verificationItem.create({
      data: {
        id: randomUUID(),
        entityType: params.entityType,
        source: 'FIELD',
        status: 'IN_REVIEW',
        assignedToId: params.createdById,
        assignedAt: new Date(),
        intakeSessionId: params.intakeSessionId,
        data: params.data as object,
        displayName: params.displayName,
        province: codes.province,
        district: codes.district,
        corregimiento: codes.corregimiento,
      },
    });
  },
};
