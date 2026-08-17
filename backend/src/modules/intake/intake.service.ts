/**
 * Servicio del módulo intake (PostgreSQL temporal → CRM).
 */
import { Prisma } from '@prisma/client';
import { logger } from '../../shared/logger/logger';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  GoneError,
} from '../../shared/errors/app-error';
import { prisma } from '../../config/database';
import { config } from '../../config/environment';
import { titleCase } from '../../shared/utils/string.utils';
import { intakeRepository } from './intake.repository';
import {
  IntakeSnapshot,
  IntakeSessionSummary,
  IntakeMigrateResult,
  IntakeStatus,
  IntakeEntityType,
  IntakePublicSessionResult,
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
  markIntakeSubmitted,
  IntakeUpdateBody,
} from './intake.writer';

const DUPLICATE_MSG = 'Este usuario ya está creado en el sistema.';

function isExpired(session: { status: string; expires_at: string }): boolean {
  return session.status === 'EXPIRED' || new Date(session.expires_at) < new Date();
}

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
    if (isExpired(session)) throw new GoneError('La sesión ha expirado');
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

  async getPublicSession(sessionId: string, accessCode?: string): Promise<IntakePublicSessionResult> {
    const snapshot = await this.getSnapshot(sessionId, accessCode);
    return {
      session: {
        sessionId: snapshot.sessionId,
        entityType: snapshot.entityType,
        status: snapshot.status,
        expiresAt: snapshot.expiresAt,
        ttlMinutes: config.intakeSessionTtlMin,
      },
      snapshot,
    };
  },

  /** Actualiza datos temporales en PostgreSQL (no crea entidades definitivas). */
  async updateSnapshot(
    sessionId: string,
    body: IntakeUpdateBody,
    accessCode?: string
  ): Promise<IntakeSnapshot> {
    await this.assertAccess(sessionId, accessCode);
    const session = await intakeRepository.getSession(sessionId);
    if (!session) throw new NotFoundError('Sesión de intake', sessionId);
    if (isExpired(session)) throw new GoneError('La sesión ha expirado');
    const entityType = session.entity_type || 'PERSON';
    await replaceIntakeSnapshot(sessionId, entityType, body, session.status);
    const updated = await intakeRepository.getSnapshot(sessionId);
    if (!updated) throw new NotFoundError('Sesión de intake', sessionId);
    return updated;
  },

  async submitSession(sessionId: string, accessCode?: string): Promise<IntakeSnapshot> {
    await this.assertAccess(sessionId, accessCode);
    const session = await intakeRepository.getSession(sessionId);
    if (!session) throw new NotFoundError('Sesión de intake', sessionId);
    if (isExpired(session)) throw new GoneError('La sesión ha expirado');
    await markIntakeSubmitted(sessionId);
    const updated = await intakeRepository.getSnapshot(sessionId);
    if (!updated) throw new NotFoundError('Sesión de intake', sessionId);
    return updated;
  },

  /** Elimina la sesión temporal (no toca entidades definitivas). */
  async deleteSession(sessionId: string): Promise<void> {
    const session = await intakeRepository.getSession(sessionId);
    if (!session) throw new NotFoundError('Sesión de intake', sessionId);
    await intakeRepository.deleteSession(sessionId);
  },

  /**
   * Valida el snapshot y lo migra a entidades definitivas del CRM
   * en una sola transacción PostgreSQL.
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
    void createdById;

    try {
      const created = await prisma.$transaction(async (tx) => {
        const entities: IntakeMigrateResult['entities'] = [];

        if (primary === 'PERSON' && hasPerson(snapshot.person)) {
          const input = snapshotToCreatePerson(snapshot);
          if (input.cedula) {
            const existing = await tx.entity.findFirst({
              where: {
                entityType: 'PERSON',
                status: { not: 'MERGED' },
                person: { cedula: input.cedula },
              },
              select: { id: true, displayName: true },
            });
            if (existing) {
              throw new ConflictError(DUPLICATE_MSG, {
                existingEntityId: existing.id,
                existingName: existing.displayName,
                entityType: 'PERSON',
              });
            }
          }
          const displayName = [titleCase(input.firstName), titleCase(input.lastName)]
            .concat(input.secondLastName ? [titleCase(input.secondLastName)] : [])
            .join(' ');
          const entity = await tx.entity.create({
            data: {
              entityType: 'PERSON',
              status: 'ACTIVE',
              displayName,
              province: input.province,
              district: input.district,
              corregimiento: input.corregimiento,
              address: input.address,
              notes: input.notes,
              sourceOrigin: input.sourceOrigin || 'EMPRENDEDORES_INTAKE',
              createdById,
              person: {
                create: {
                  firstName: input.firstName,
                  lastName: input.lastName,
                  secondLastName: input.secondLastName,
                  cedula: input.cedula,
                  gender: input.gender,
                  birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
                  nationalityCode: input.nationalityCode,
                  educationLevel: input.educationLevel,
                },
              },
              contacts: input.contacts?.length
                ? { create: input.contacts as Prisma.EntityContactCreateWithoutEntityInput[] }
                : undefined,
            },
          });
          entities.push({ id: entity.id, entityType: 'PERSON', displayName: entity.displayName });
        } else if (primary === 'COMPANY' && hasCompany(snapshot.company)) {
          const input = snapshotToCreateCompany(snapshot);
          if (input.ruc) {
            const existing = await tx.entity.findFirst({
              where: {
                entityType: 'COMPANY',
                status: { not: 'MERGED' },
                company: { ruc: input.ruc },
              },
              select: { id: true, displayName: true },
            });
            if (existing) {
              throw new ConflictError(DUPLICATE_MSG, {
                existingEntityId: existing.id,
                existingName: existing.displayName,
                entityType: 'COMPANY',
              });
            }
          }
          const displayName = input.tradeName
            ? `${input.tradeName} (${input.legalName})`
            : input.legalName;
          const entity = await tx.entity.create({
            data: {
              entityType: 'COMPANY',
              status: 'ACTIVE',
              displayName,
              province: input.province,
              district: input.district,
              corregimiento: input.corregimiento,
              address: input.address,
              notes: input.notes,
              sourceOrigin: input.sourceOrigin || 'EMPRENDEDORES_INTAKE',
              createdById,
              company: {
                create: {
                  legalName: input.legalName,
                  tradeName: input.tradeName,
                  ruc: input.ruc,
                  dv: input.dv,
                  companyType: input.companyType,
                  economicActivity: input.economicActivity,
                  foundedDate: input.foundedDate ? new Date(input.foundedDate) : undefined,
                  employeeCount: input.employeeCount,
                },
              },
              contacts: input.contacts?.length
                ? { create: input.contacts as Prisma.EntityContactCreateWithoutEntityInput[] }
                : undefined,
            },
          });
          entities.push({ id: entity.id, entityType: 'COMPANY', displayName: entity.displayName });
        } else if (primary === 'ESTABLISHMENT' && hasEstablishment(snapshot.establishment)) {
          const input = snapshotToCreateEstablishment(snapshot);
          const notice = snapshot.establishment?.notice_of_operation?.trim();
          if (notice) {
            const existing = await tx.entity.findFirst({
              where: {
                entityType: 'ESTABLISHMENT',
                status: { not: 'MERGED' },
                establishment: { noticeOfOperation: notice },
              },
              select: { id: true, displayName: true },
            });
            if (existing) {
              throw new ConflictError(DUPLICATE_MSG, {
                existingEntityId: existing.id,
                existingName: existing.displayName,
                entityType: 'ESTABLISHMENT',
              });
            }
          }
          const displayName = input.address
            ? `${input.establishmentName} - ${input.address}`
            : input.establishmentName;
          const entity = await tx.entity.create({
            data: {
              entityType: 'ESTABLISHMENT',
              status: 'ACTIVE',
              displayName,
              province: input.province,
              district: input.district,
              corregimiento: input.corregimiento,
              address: input.address,
              notes: input.notes,
              sourceOrigin: input.sourceOrigin || 'EMPRENDEDORES_INTAKE',
              createdById,
              establishment: {
                create: {
                  establishmentName: input.establishmentName,
                  establishmentType: input.establishmentType,
                  economicActivity: input.economicActivity,
                  noticeOfOperation: input.noticeOfOperation,
                },
              },
              contacts: input.contacts?.length
                ? { create: input.contacts as Prisma.EntityContactCreateWithoutEntityInput[] }
                : undefined,
            },
          });
          entities.push({
            id: entity.id,
            entityType: 'ESTABLISHMENT',
            displayName: entity.displayName,
          });
        } else {
          throw new BadRequestError('No hay datos para migrar según el tipo de sesión.');
        }

        await intakeRepository.deleteSession(sessionId, tx);
        return entities;
      });

      logger.info('[intake] sesión migrada a PostgreSQL', {
        sessionId,
        entities: created.map((e) => e.id),
      });

      return { sessionId, entities: created };
    } catch (err) {
      if (err instanceof ConflictError) {
        throw new ConflictError(DUPLICATE_MSG, {
          ...(err.details ?? {}),
          entityType: primary,
        });
      }
      throw err;
    }
  },

  startExpirySweep(onExpired?: (sessionIds: string[]) => void): NodeJS.Timeout {
    const intervalMs = 60 * 1000;
    const timer = setInterval(async () => {
      try {
        const removed = await intakeRepository.cleanupExpired();
        if (removed.length > 0) {
          logger.info(`[intake] ${removed.length} sesión(es) expirada(s) eliminada(s)`);
          onExpired?.(removed);
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
