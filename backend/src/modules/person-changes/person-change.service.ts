/**
 * Cola de confirmación de cambios de persona.
 * CREATE/UPDATE/DELETE quedan PENDING hasta que el mismo usuario confirme.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors/app-error';
import { PaginationMeta } from '../../shared/types/api-response.types';
import { CreatePersonInput, UpdatePersonInput } from '../persons/person.validator';
import { personService } from '../persons/person.service';
import { auditService, AuditActor } from '../audit/audit.service';
import { actorContext } from '../audit/audit-snapshot';
import { ListMyChangeRequestsInput } from './person-change.validator';
import {
  buildUpdateDiff,
  flattenPersonInput,
  snapshotPersonFields,
  unwrapApplyPayload,
  wrapChangePayload,
} from './person-change-diff';
import { entityService } from '../entities/entity.service';
import { capitalSemillaService } from '../capital-semilla/capital-semilla.service';

function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

function summaryForCreate(input: CreatePersonInput): string {
  return `Crear persona: ${input.firstName} ${input.lastName}`.trim();
}

function summaryForUpdate(entityLabel: string): string {
  return `Actualizar persona: ${entityLabel}`;
}

function summaryForDelete(entityLabel: string): string {
  return `Eliminar (soft) persona: ${entityLabel}`;
}

function payloadBeforeAfter(payload: unknown): {
  anterior: Record<string, unknown> | null;
  nuevo: Record<string, unknown> | null;
} {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { anterior: null, nuevo: null };
  }
  const row = payload as { before?: unknown; after?: unknown };
  return {
    anterior:
      row.before && typeof row.before === 'object' && !Array.isArray(row.before)
        ? (row.before as Record<string, unknown>)
        : null,
    nuevo:
      row.after && typeof row.after === 'object' && !Array.isArray(row.after)
        ? (row.after as Record<string, unknown>)
        : null,
  };
}

export const personChangeService = {
  async hasPendingForEntity(entityId: string): Promise<boolean> {
    const pending = await prisma.personChangeRequest.findFirst({
      where: { entityId, status: 'PENDING' },
      select: { id: true },
    });
    return Boolean(pending);
  },

  async assertNoPendingForEntity(entityId: string): Promise<void> {
    if (await this.hasPendingForEntity(entityId)) {
      throw new BadRequestError(
        'Esta entidad tiene cambios pendientes de confirmación. Confírmelos o cancele antes de editar.'
      );
    }
  },

  async enqueueCreate(input: CreatePersonInput, actor: AuditActor) {
    const after = flattenPersonInput(input as unknown as Record<string, unknown>);
    const payload = wrapChangePayload({}, after, input);
    const row = await prisma.personChangeRequest.create({
      data: {
        action: 'CREATE',
        status: 'PENDING',
        payload: payload as unknown as Prisma.InputJsonValue,
        summary: summaryForCreate(input),
        requestedById: actor.userId,
      },
    });
    return {
      queued: true,
      id: row.id,
      action: row.action,
      status: row.status,
      summary: row.summary,
      message: 'Cambio pendiente de confirmación',
    };
  },

  async enqueueUpdate(entityId: string, input: UpdatePersonInput, actor: AuditActor) {
    await this.assertNoPendingForEntity(entityId);
    const entity = await personService.getById(entityId);
    const current = snapshotPersonFields(entity);
    const { before, after } = buildUpdateDiff(
      current,
      input as unknown as Record<string, unknown>
    );
    const payload = wrapChangePayload(before, after, input);
    const row = await prisma.personChangeRequest.create({
      data: {
        action: 'UPDATE',
        status: 'PENDING',
        entityId,
        personId: entity.person?.id,
        payload: payload as unknown as Prisma.InputJsonValue,
        summary: summaryForUpdate(entity.displayName),
        requestedById: actor.userId,
      },
    });
    return {
      queued: true,
      id: row.id,
      action: row.action,
      status: row.status,
      summary: row.summary,
      message: 'Cambio pendiente de confirmación',
    };
  },

  async enqueueDelete(entityId: string, actor: AuditActor) {
    await this.assertNoPendingForEntity(entityId);
    const entity = await personService.getById(entityId);
    const before = snapshotPersonFields(entity);
    const payload = wrapChangePayload(before, {}, { entityId });
    const row = await prisma.personChangeRequest.create({
      data: {
        action: 'DELETE',
        status: 'PENDING',
        entityId,
        personId: entity.person?.id,
        payload: payload as unknown as Prisma.InputJsonValue,
        summary: summaryForDelete(entity.displayName),
        requestedById: actor.userId,
      },
    });
    return {
      queued: true,
      id: row.id,
      action: row.action,
      status: row.status,
      summary: row.summary,
      message: 'Eliminación pendiente de confirmación',
    };
  },

  async enqueueRegistroEmpresarial(
    entityId: string,
    fecha: string | null,
    actor: AuditActor
  ) {
    await this.assertNoPendingForEntity(entityId);
    const entity = await entityService.getById(entityId);
    const anterior = entity.registroEmpresarialFecha
      ? entity.registroEmpresarialFecha.toISOString().slice(0, 10)
      : null;
    const payload = wrapChangePayload(
      { registroEmpresarialFecha: anterior },
      { registroEmpresarialFecha: fecha },
      { entityId, fecha }
    );
    const row = await prisma.personChangeRequest.create({
      data: {
        action: 'REGISTRO_EMPRESARIAL',
        status: 'PENDING',
        entityId,
        payload: payload as unknown as Prisma.InputJsonValue,
        summary: fecha
          ? `Registro empresarial: ${entity.displayName} → ${fecha}`
          : `Quitar registro empresarial: ${entity.displayName}`,
        requestedById: actor.userId,
      },
    });
    return {
      queued: true,
      id: row.id,
      action: row.action,
      status: row.status,
      summary: row.summary,
      message: 'Cambio pendiente de confirmación',
    };
  },

  async enqueueCapitalSemilla(entityId: string, linkedAt: string | null, actor: AuditActor) {
    await this.assertNoPendingForEntity(entityId);
    const person = await prisma.person.findUnique({
      where: { entityId },
      include: {
        entity: { select: { displayName: true } },
        capitalSemilla: { select: { linkedAt: true } },
      },
    });
    if (!person) throw new NotFoundError('Persona', entityId);

    const anterior = person.capitalSemilla?.linkedAt
      ? person.capitalSemilla.linkedAt.toISOString().slice(0, 10)
      : null;
    const payload = wrapChangePayload(
      { linkedAt: anterior },
      { linkedAt },
      { entityId, linkedAt }
    );
    const row = await prisma.personChangeRequest.create({
      data: {
        action: 'CAPITAL_SEMILLA',
        status: 'PENDING',
        entityId,
        personId: person.id,
        payload: payload as unknown as Prisma.InputJsonValue,
        summary: linkedAt
          ? `Capital semilla: ${person.entity.displayName} → ${linkedAt}`
          : `Quitar capital semilla: ${person.entity.displayName}`,
        requestedById: actor.userId,
      },
    });
    return {
      queued: true,
      id: row.id,
      action: row.action,
      status: row.status,
      summary: row.summary,
      message: 'Cambio pendiente de confirmación',
    };
  },

  async listMine(actor: AuditActor, filters: ListMyChangeRequestsInput) {
    const where: Prisma.PersonChangeRequestWhereInput = {
      requestedById: actor.userId,
    };

    const documento = filters.documento?.trim();
    if (documento) {
      where.status = 'PENDING';

      const entities = await prisma.entity.findMany({
        where: {
          status: { not: 'MERGED' },
          OR: [
            { person: { OR: [{ cedula: documento }, { documentNumber: documento }] } },
            { company: { ruc: documento } },
          ],
        },
        select: { id: true },
      });
      const entityIds = entities.map((row) => row.id);

      where.OR = [
        ...(entityIds.length > 0 ? [{ entityId: { in: entityIds } }] : []),
        { payload: { path: ['after', 'documentNumber'], equals: documento } },
        { payload: { path: ['after', 'cedula'], equals: documento } },
        { payload: { path: ['apply', 'documentNumber'], equals: documento } },
        { payload: { path: ['apply', 'cedula'], equals: documento } },
        { payload: { path: ['before', 'documentNumber'], equals: documento } },
        { payload: { path: ['before', 'cedula'], equals: documento } },
      ];

      // Sin coincidencias de entidad ni payload, devolver vacío
      if (entityIds.length === 0) {
        // OR de payload sigue activo para CREATE pendientes
      }
    } else if (filters.status !== 'ALL') {
      where.status = filters.status;
    }

    const [data, total] = await Promise.all([
      prisma.personChangeRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.personChangeRequest.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, filters.page, filters.limit) };
  },

  async confirm(id: string, actor: AuditActor) {
    const row = await prisma.personChangeRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Solicitud de cambio', id);
    if (row.requestedById !== actor.userId) {
      throw new ForbiddenError('Solo quien solicitó el cambio puede confirmarlo');
    }
    if (row.status !== 'PENDING') {
      throw new BadRequestError('La solicitud ya no está pendiente');
    }

    let applied: unknown = null;
    const applyPayload = unwrapApplyPayload(row.payload);

    if (row.action === 'CREATE') {
      applied = await personService.create(applyPayload as CreatePersonInput, actor);
    } else if (row.action === 'UPDATE') {
      if (!row.entityId) throw new BadRequestError('Solicitud UPDATE sin entityId');
      applied = await personService.update(row.entityId, applyPayload as UpdatePersonInput, actor);
    } else if (row.action === 'DELETE') {
      if (!row.entityId) throw new BadRequestError('Solicitud DELETE sin entityId');
      applied = await personService.remove(row.entityId, actor);
    } else if (row.action === 'REGISTRO_EMPRESARIAL') {
      const body = applyPayload as { entityId: string; fecha: string | null };
      if (!body?.entityId) throw new BadRequestError('Solicitud REGISTRO_EMPRESARIAL sin entityId');
      applied = await entityService.setRegistroEmpresarialFecha(
        body.entityId,
        { fecha: body.fecha },
        actor
      );
    } else if (row.action === 'CAPITAL_SEMILLA') {
      const body = applyPayload as { entityId: string; linkedAt: string | null };
      if (!body?.entityId) throw new BadRequestError('Solicitud CAPITAL_SEMILLA sin entityId');
      applied = await capitalSemillaService.setLinkedAtByEntity(
        body.entityId,
        body.linkedAt,
        actor
      );
    } else {
      throw new BadRequestError('Acción no soportada');
    }

    const entityId = (applied as { id?: string } | null)?.id ?? row.entityId;
    const updated = await prisma.personChangeRequest.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        entityId,
      },
    });

    if (entityId) {
      await this.logConfirmacionAudit(entityId, row, actor, 'CONFIRMED');
    }

    return { request: updated, applied };
  },

  async cancel(id: string, actor: AuditActor) {
    const row = await prisma.personChangeRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Solicitud de cambio', id);
    if (row.requestedById !== actor.userId) {
      throw new ForbiddenError('Solo quien solicitó el cambio puede cancelarlo');
    }
    if (row.status !== 'PENDING') {
      throw new BadRequestError('La solicitud ya no está pendiente');
    }

    const updated = await prisma.personChangeRequest.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    if (row.entityId) {
      await this.logConfirmacionAudit(row.entityId, row, actor, 'CANCELLED');
    }

    return updated;
  },

  async logConfirmacionAudit(
    entityId: string,
    row: {
      action: string;
      summary: string | null;
      payload: unknown;
      entityId: string | null;
    },
    actor: AuditActor,
    confirmacion: 'CONFIRMED' | 'CANCELLED'
  ) {
    const entity = await prisma.entity.findUnique({
      where: { id: entityId },
      select: { id: true, entityType: true, displayName: true },
    });
    if (!entity) return;

    const quien = await actorContext(actor);
    const { anterior, nuevo } = payloadBeforeAfter(row.payload);

    await auditService.log({
      action: 'UPDATE',
      entityType: entity.entityType,
      entityId: entity.id,
      entityLabel: entity.displayName,
      userId: actor.userId,
      userEmail: actor.userEmail,
      metadata: {
        ...quien,
        confirmacion,
        solicitudAccion: row.action,
        summary: row.summary,
        anterior,
        nuevo,
      },
    });
  },
};
