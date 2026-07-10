/**
 * Servicio del módulo intake.
 */
import { logger } from '../../shared/logger/logger';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
} from '../../shared/errors/app-error';
import { tempDb } from '../../config/temp-db';
import { personService } from '../persons/person.service';
import { companyService } from '../companies/company.service';
import { establishmentService } from '../establishments/establishment.service';
import { establishmentRepository } from '../establishments/establishment.repository';
import { intakeRepository } from './intake.repository';
import {
  IntakeSnapshot,
  IntakeSessionSummary,
  IntakeMigrateResult,
  IntakeStatus,
  IntakeEntityType,
} from './intake.types';
import {
  validateSnapshot,
  hasPerson,
  hasCompany,
  hasEstablishment,
  snapshotToCreatePerson,
  snapshotToCreateCompany,
  snapshotToCreateEstablishment,
} from './intake.mapper';
import {
  replaceIntakeSnapshot,
  assertIntakeSessionActive,
  IntakeUpdateBody,
} from './intake.writer';

const DUPLICATE_MSG = 'Este usuario ya está creado en el sistema.';

export const intakeService = {
  async createSession(
    createdBy: string | null,
    entityType: IntakeEntityType = 'PERSON'
  ): Promise<{
    sessionId: string;
    expiresAt: string;
    entityType: IntakeEntityType;
    accessCode: string;
  }> {
    const { session, accessCode } = await intakeRepository.createSession(createdBy, entityType);
    return {
      sessionId: session.session_id,
      expiresAt: session.expires_at,
      entityType: session.entity_type,
      accessCode,
    };
  },

  async listCreators(): Promise<string[]> {
    return intakeRepository.listCreators();
  },

  async listSessions(status?: IntakeStatus, createdBy?: string): Promise<IntakeSessionSummary[]> {
    return intakeRepository.listSessions(status, createdBy);
  },

  /** Verifica el código de acceso sin devolver datos. */
  async verifyAccess(sessionId: string, accessCode: string): Promise<void> {
    const session = await intakeRepository.getSession(sessionId);
    if (!session) throw new NotFoundError('Sesión de intake', sessionId);
    const ok = await intakeRepository.verifySessionAccess(sessionId, accessCode);
    if (!ok) throw new UnauthorizedError('Código de acceso incorrecto');
  },

  /** Regenera el código de acceso (solo se muestra una vez en la respuesta). */
  async regenerateAccessCode(sessionId: string): Promise<{ accessCode: string }> {
    const session = await intakeRepository.getSession(sessionId);
    if (!session) throw new NotFoundError('Sesión de intake', sessionId);
    const accessCode = await intakeRepository.regenerateAccessCode(sessionId);
    return { accessCode };
  },

  async assertAccess(sessionId: string, accessCode: string | undefined): Promise<void> {
    if (!accessCode?.trim()) {
      throw new UnauthorizedError('Código de acceso requerido');
    }
    await this.verifyAccess(sessionId, accessCode);
  },

  async getSnapshot(sessionId: string, accessCode?: string): Promise<IntakeSnapshot> {
    await this.assertAccess(sessionId, accessCode);
    const snapshot = await intakeRepository.getSnapshot(sessionId);
    if (!snapshot) throw new NotFoundError('Sesión de intake', sessionId);
    return snapshot;
  },

  /** Actualiza datos en MySQL temporal (no toca PostgreSQL). */
  async updateSnapshot(
    sessionId: string,
    body: IntakeUpdateBody,
    accessCode?: string
  ): Promise<IntakeSnapshot> {
    await this.assertAccess(sessionId, accessCode);
    const db = tempDb();
    let sessionRow;
    try {
      sessionRow = await assertIntakeSessionActive(db, sessionId);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      if (code === 'SESSION_NOT_FOUND') throw new NotFoundError('Sesión de intake', sessionId);
      if (code === 'SESSION_EXPIRED') throw new BadRequestError('La sesión ha expirado');
      throw e;
    }
    const entityType = (sessionRow.entity_type as IntakeEntityType) || 'PERSON';
    await replaceIntakeSnapshot(db, sessionId, entityType, body);
    const updated = await intakeRepository.getSnapshot(sessionId);
    if (!updated) throw new NotFoundError('Sesión de intake', sessionId);
    return updated;
  },

  /** Elimina la sesión de MySQL temporal (no toca PostgreSQL). */
  async deleteSession(sessionId: string): Promise<void> {
    const session = await intakeRepository.getSession(sessionId);
    if (!session) throw new NotFoundError('Sesión de intake', sessionId);
    await intakeRepository.deleteSession(sessionId);
  },

  /**
   * Valida el snapshot y lo migra a PostgreSQL usando los mismos servicios CRUD
   * del CRM (deduplicación por cédula / RUC / aviso de operación).
   */
  async validateAndMigrate(
    sessionId: string,
    createdById?: string,
    accessCode?: string
  ): Promise<IntakeMigrateResult> {
    await this.assertAccess(sessionId, accessCode);
    const snapshot = await intakeRepository.getSnapshot(sessionId);
    if (!snapshot) throw new NotFoundError('Sesión de intake', sessionId);

    const { valid, errors } = validateSnapshot(snapshot);
    if (!valid) {
      throw new BadRequestError(`Datos incompletos: ${errors.join(' ')}`, { errors });
    }

    const primary = snapshot.entityType;
    const created: IntakeMigrateResult['entities'] = [];

    try {
      if (primary === 'PERSON' && hasPerson(snapshot.person)) {
        const e = await personService.create(snapshotToCreatePerson(snapshot));
        created.push({ id: e.id, entityType: 'PERSON', displayName: e.displayName });
      } else if (primary === 'COMPANY' && hasCompany(snapshot.company)) {
        const e = await companyService.create(snapshotToCreateCompany(snapshot));
        created.push({ id: e.id, entityType: 'COMPANY', displayName: e.displayName });
      } else if (primary === 'ESTABLISHMENT' && hasEstablishment(snapshot.establishment)) {
        const notice = snapshot.establishment?.notice_of_operation?.trim();
        if (notice) {
          const existing = await establishmentRepository.findByNoticeOfOperation(notice);
          if (existing) {
            throw new ConflictError(DUPLICATE_MSG, {
              existingEntityId: existing.id,
              existingName: existing.displayName,
            });
          }
        }
        const e = await establishmentService.create(snapshotToCreateEstablishment(snapshot));
        created.push({
          id: e.id,
          entityType: 'ESTABLISHMENT',
          displayName: e.displayName,
        });
      } else {
        throw new BadRequestError('No hay datos para migrar según el tipo de sesión.');
      }
    } catch (err) {
      if (err instanceof ConflictError) {
        throw new ConflictError(DUPLICATE_MSG, {
          ...(err.details ?? {}),
          entityType: primary,
        });
      }
      throw err;
    }

    void createdById; // reservado para trazabilidad futura en servicios CRUD

    await intakeRepository.deleteSession(sessionId);

    logger.info('[intake] sesión migrada a PostgreSQL', {
      sessionId,
      entities: created.map((e) => e.id),
    });

    return { sessionId, entities: created };
  },

  startExpirySweep(): NodeJS.Timeout {
    const intervalMs = 60 * 1000;
    const timer = setInterval(async () => {
      try {
        const removed = await intakeRepository.cleanupExpired();
        if (removed.length > 0) {
          logger.info(`[intake] ${removed.length} sesión(es) expirada(s) eliminada(s)`);
        }
      } catch (err) {
        logger.warn('[intake] error en barrido de expiración', {
          error: err instanceof Error ? err.message : err,
        });
      }
    }, intervalMs);
    timer.unref?.();
    return timer;
  },
};
