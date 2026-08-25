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
  snapshotToCreatePerson,
  snapshotToCreateCompany,
} from './intake.mapper';
import {
  replaceIntakeSnapshot,
  markIntakeSubmitted,
  IntakeUpdateBody,
} from './intake.writer';
import { auditService } from '../audit/audit.service';

const DUPLICATE_MSG = 'Este usuario ya está creado en el sistema.';

function isExpired(session: { status: string; expires_at: string }): boolean {
  return session.status === 'EXPIRED' || new Date(session.expires_at) < new Date();
}

export const intakeService = {
  async createSession(
    createdBy: string | null,
    entityType: IntakeEntityType = 'PERSON',
    ttlMinutes?: number
  ): Promise<{
    sessionId: string;
    expiresAt: string;
    entityType: IntakeEntityType;
    accessCode: string;
  }> {
    const { session, accessCode } = await intakeRepository.createSession(
      createdBy,
      entityType,
      ttlMinutes
    );
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

  async verifyAccess(sessionId: string, accessCode: string): Promise<void> {
    const session = await intakeRepository.getSession(sessionId);
    if (!session) throw new NotFoundError('Sesión de intake', sessionId);
    if (isExpired(session)) throw new GoneError('La sesión ha expirado');
    const ok = await intakeRepository.verifySessionAccess(sessionId, accessCode);
    if (!ok) throw new UnauthorizedError('Código de acceso incorrecto');
  },

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
        ttlMinutes: config.intakeSessionTtlMin, // FIELD / QR. IMPORT usa 30 min (intake-ttl.ts)
      },
      snapshot,
    };
  },

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

  async deleteSession(sessionId: string): Promise<void> {
    const session = await intakeRepository.getSession(sessionId);
    if (!session) throw new NotFoundError('Sesión de intake', sessionId);
    await intakeRepository.deleteSession(sessionId);
  },

  async validateAndMigrate(
    sessionId: string,
    createdById?: string,
    accessCode?: string,
    actorEmail?: string,
    options?: { skipAccessCheck?: boolean; onDuplicate?: 'reject' | 'update' }
  ): Promise<IntakeMigrateResult> {
    if (!options?.skipAccessCheck) {
      await this.assertAccess(sessionId, accessCode);
    }
    const snapshot = await intakeRepository.getSnapshot(sessionId);
    if (!snapshot) throw new NotFoundError('Sesión de intake', sessionId);

    const { valid, errors } = validateSnapshot(snapshot);
    if (!valid) {
      throw new BadRequestError(`Datos incompletos: ${errors.join(' ')}`, { errors });
    }

    const onDuplicate = options?.onDuplicate ?? 'reject';

    try {
      const created = await prisma.$transaction(async (tx) => {
        const entities: IntakeMigrateResult['entities'] = [];

        if (hasPerson(snapshot.person)) {
          const input = snapshotToCreatePerson(snapshot);
          let existing = input.cedula
            ? await tx.entity.findFirst({
                where: {
                  entityType: 'PERSON',
                  status: { not: 'MERGED' },
                  person: { cedula: input.cedula },
                },
                select: { id: true, displayName: true },
              })
            : null;

          if (existing && onDuplicate === 'reject') {
            throw new ConflictError(DUPLICATE_MSG, {
              existingEntityId: existing.id,
              existingName: existing.displayName,
              entityType: 'PERSON',
            });
          }

          const displayName = [titleCase(input.firstName), titleCase(input.lastName)]
            .concat(input.secondLastName ? [titleCase(input.secondLastName)] : [])
            .join(' ');

          if (existing && onDuplicate === 'update') {
            await tx.entityContact.deleteMany({ where: { entityId: existing.id } });
            const entity = await tx.entity.update({
              where: { id: existing.id },
              data: {
                displayName,
                province: input.province,
                district: input.district,
                corregimiento: input.corregimiento,
                address: input.address,
                notes: input.notes,
                status: 'ACTIVE',
                person: {
                  update: {
                    firstName: input.firstName,
                    lastName: input.lastName,
                    secondLastName: input.secondLastName,
                    gender: input.gender,
                    birthDate: input.birthDate ? new Date(input.birthDate) : null,
                    nationalityCode: input.nationalityCode,
                    educationLevel: input.educationLevel,
                    hasArtisanCard: input.hasArtisanCard,
                  },
                },
                contacts: input.contacts?.length
                  ? { create: input.contacts as Prisma.EntityContactCreateWithoutEntityInput[] }
                  : undefined,
              },
            });
            entities.push({ id: entity.id, entityType: 'PERSON', displayName: entity.displayName });
          } else {
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
                    hasArtisanCard: input.hasArtisanCard,
                  },
                },
                contacts: input.contacts?.length
                  ? { create: input.contacts as Prisma.EntityContactCreateWithoutEntityInput[] }
                  : undefined,
              },
            });
            entities.push({ id: entity.id, entityType: 'PERSON', displayName: entity.displayName });
          }
        }

        if (hasCompany(snapshot.company)) {
          const input = snapshotToCreateCompany(snapshot);
          let existing = input.ruc
            ? await tx.entity.findFirst({
                where: {
                  entityType: 'COMPANY',
                  status: { not: 'MERGED' },
                  company: { ruc: input.ruc },
                },
                select: { id: true, displayName: true },
              })
            : await tx.entity.findFirst({
                where: {
                  entityType: 'COMPANY',
                  status: { not: 'MERGED' },
                  company: { legalName: { equals: input.legalName, mode: 'insensitive' } },
                },
                select: { id: true, displayName: true },
              });

          if (existing && onDuplicate === 'reject') {
            throw new ConflictError(DUPLICATE_MSG, {
              existingEntityId: existing.id,
              existingName: existing.displayName,
              entityType: 'COMPANY',
            });
          }

          const displayName = input.tradeName
            ? `${input.tradeName} (${input.legalName})`
            : input.legalName;

          if (existing && onDuplicate === 'update') {
            await tx.entityContact.deleteMany({ where: { entityId: existing.id } });
            const entity = await tx.entity.update({
              where: { id: existing.id },
              data: {
                displayName,
                province: input.province,
                district: input.district,
                corregimiento: input.corregimiento,
                address: input.address,
                notes: input.notes,
                status: 'ACTIVE',
                company: {
                  update: {
                    legalName: input.legalName,
                    tradeName: input.tradeName,
                    dv: input.dv,
                    companyType: input.companyType,
                    companySizeClass: input.companySizeClass,
                    foundedDate: input.foundedDate ? new Date(input.foundedDate) : null,
                  },
                },
                contacts: input.contacts?.length
                  ? { create: input.contacts as Prisma.EntityContactCreateWithoutEntityInput[] }
                  : undefined,
              },
            });
            entities.push({ id: entity.id, entityType: 'COMPANY', displayName: entity.displayName });
          } else {
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
                    companySizeClass: input.companySizeClass,
                    foundedDate: input.foundedDate ? new Date(input.foundedDate) : undefined,
                  },
                },
                contacts: input.contacts?.length
                  ? { create: input.contacts as Prisma.EntityContactCreateWithoutEntityInput[] }
                  : undefined,
              },
            });
            entities.push({ id: entity.id, entityType: 'COMPANY', displayName: entity.displayName });
          }
        }

        const personCreated = entities.find((e) => e.entityType === 'PERSON');
        const companyCreated = entities.find((e) => e.entityType === 'COMPANY');
        if (personCreated && companyCreated) {
          const existingRel = await tx.entityRelationship.findFirst({
            where: {
              OR: [
                { fromEntityId: personCreated.id, toEntityId: companyCreated.id },
                { fromEntityId: companyCreated.id, toEntityId: personCreated.id },
              ],
            },
          });
          if (!existingRel) {
            await tx.entityRelationship.create({
              data: {
                fromEntityId: personCreated.id,
                toEntityId: companyCreated.id,
                relationshipType: 'OWNER',
                isActive: true,
              },
            });
          }
        }

        if (entities.length === 0) {
          throw new BadRequestError('No hay datos para migrar según el tipo de sesión.');
        }

        await intakeRepository.deleteSession(sessionId, tx);
        return entities;
      });

      for (const e of created) {
        await auditService.log({
          action: 'CREATE',
          entityType: e.entityType,
          entityId: e.id,
          entityLabel: e.displayName,
          userId: createdById,
          userEmail: actorEmail,
          metadata: { source: 'INTAKE', sessionId, onDuplicate },
        });
      }

      logger.info('[intake] sesión migrada a PostgreSQL', {
        sessionId,
        entities: created.map((e) => e.id),
        onDuplicate,
      });

      return { sessionId, entities: created };
    } catch (err) {
      if (err instanceof ConflictError) {
        throw new ConflictError(DUPLICATE_MSG, {
          ...(err.details ?? {}),
          entityType: snapshot.entityType,
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
