/**
 * Cola de confirmación de cambios de persona.
 * CREATE/UPDATE/DELETE quedan PENDING hasta que un admin u operador confirme.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { BadRequestError, NotFoundError } from '../../shared/errors/app-error';
import { PaginationMeta } from '../../shared/types/api-response.types';
import { CreatePersonInput, UpdatePersonInput } from '../persons/person.validator';
import { CreateCompanyInput, UpdateCompanyInput } from '../companies/company.validator';
import { personService } from '../persons/person.service';
import { companyService } from '../companies/company.service';
import { auditService, AuditActor } from '../audit/audit.service';
import { actorContext } from '../audit/audit-snapshot';
import { ListMyChangeRequestsInput } from './person-change.validator';
import {
  buildCompanyUpdateDiff,
  buildUpdateDiff,
  flattenCompanyInput,
  flattenPersonInput,
  payloadEntityKind,
  snapshotCompanyFields,
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

function summaryForCreateCompany(input: CreateCompanyInput): string {
  const name = input.tradeName || input.legalName;
  return `Crear empresa: ${name}${input.ruc ? ` (${input.ruc})` : ''}`.trim();
}

function summaryForUpdate(entityLabel: string, kind: 'persona' | 'empresa' = 'persona'): string {
  return `Actualizar ${kind}: ${entityLabel}`;
}

function summaryForDelete(entityLabel: string, kind: 'persona' | 'empresa' = 'persona'): string {
  return `Eliminar (soft) ${kind}: ${entityLabel}`;
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

function normalizeDocumentoKey(value: string): string {
  return value.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
}

function payloadMentionsDocumento(payload: unknown, documento: string, documentoKey: string): boolean {
  if (payload == null) return false;
  const text = JSON.stringify(payload).toUpperCase();
  if (text.includes(documento.trim().toUpperCase())) return true;
  if (documentoKey.length >= 4 && text.replace(/[^0-9A-Z]/g, '').includes(documentoKey)) return true;
  return false;
}

function mapChangeRequestRow(row: {
  id: string;
  action: string;
  status: string;
  entityId: string | null;
  personId: string | null;
  payload: unknown;
  summary: string | null;
  requestedById: string;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt?: Date;
  requestedBy?: {
    id: string;
    username: string | null;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}) {
  const { requestedBy, ...rest } = row;
  return {
    ...rest,
    requestedBy: requestedBy
      ? {
          id: requestedBy.id,
          username: requestedBy.username,
          email: requestedBy.email,
          displayName:
            (requestedBy.username && !requestedBy.username.includes('@')
              ? requestedBy.username
              : requestedBy.username?.includes('@')
                ? requestedBy.username.split('@')[0]
                : null) ||
            [requestedBy.firstName, requestedBy.lastName].filter(Boolean).join(' ').trim() ||
            requestedBy.username ||
            requestedBy.email,
        }
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
    const payload = wrapChangePayload({}, after, input, 'PERSON');
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

  async enqueueCreateCompany(input: CreateCompanyInput, actor: AuditActor) {
    const after = flattenCompanyInput(input as unknown as Record<string, unknown>);
    const payload = wrapChangePayload({}, after, input, 'COMPANY');
    const row = await prisma.personChangeRequest.create({
      data: {
        action: 'CREATE',
        status: 'PENDING',
        payload: payload as unknown as Prisma.InputJsonValue,
        summary: summaryForCreateCompany(input),
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
    const payload = wrapChangePayload(before, after, input, 'PERSON');
    const row = await prisma.personChangeRequest.create({
      data: {
        action: 'UPDATE',
        status: 'PENDING',
        entityId,
        personId: entity.person?.id,
        payload: payload as unknown as Prisma.InputJsonValue,
        summary: summaryForUpdate(entity.displayName, 'persona'),
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

  async enqueueUpdateCompany(entityId: string, input: UpdateCompanyInput, actor: AuditActor) {
    await this.assertNoPendingForEntity(entityId);
    const entity = await companyService.getById(entityId);
    const current = snapshotCompanyFields(entity);
    const { before, after } = buildCompanyUpdateDiff(
      current,
      input as unknown as Record<string, unknown>
    );
    const payload = wrapChangePayload(before, after, input, 'COMPANY');
    const row = await prisma.personChangeRequest.create({
      data: {
        action: 'UPDATE',
        status: 'PENDING',
        entityId,
        payload: payload as unknown as Prisma.InputJsonValue,
        summary: summaryForUpdate(entity.displayName, 'empresa'),
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
    const payload = wrapChangePayload(before, {}, { entityId }, 'PERSON');
    const row = await prisma.personChangeRequest.create({
      data: {
        action: 'DELETE',
        status: 'PENDING',
        entityId,
        personId: entity.person?.id,
        payload: payload as unknown as Prisma.InputJsonValue,
        summary: summaryForDelete(entity.displayName, 'persona'),
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

  async enqueueDeleteCompany(entityId: string, actor: AuditActor) {
    await this.assertNoPendingForEntity(entityId);
    const entity = await companyService.getById(entityId);
    const before = snapshotCompanyFields(entity);
    const payload = wrapChangePayload(before, {}, { entityId }, 'COMPANY');
    const row = await prisma.personChangeRequest.create({
      data: {
        action: 'DELETE',
        status: 'PENDING',
        entityId,
        payload: payload as unknown as Prisma.InputJsonValue,
        summary: summaryForDelete(entity.displayName, 'empresa'),
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
        capitalSemilla: { take: 1, select: { linkedAt: true } },
      },
    });
    if (!person) throw new NotFoundError('Persona', entityId);

    const anterior = person.capitalSemilla?.[0]?.linkedAt
      ? person.capitalSemilla[0].linkedAt.toISOString().slice(0, 10)
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
    const documento = filters.documento?.trim();
    const statusFilter = filters.status !== 'ALL' ? filters.status : undefined;
    const mineOnly = Boolean(filters.mineOnly);

    const requestedBySelect = {
      id: true,
      username: true,
      email: true,
      firstName: true,
      lastName: true,
    } as const;

    // Sin documento: listado general (o solo las del usuario si mineOnly)
    if (!documento) {
      const where: Prisma.PersonChangeRequestWhereInput = {};
      if (statusFilter) where.status = statusFilter;
      else where.status = 'PENDING';
      if (mineOnly) where.requestedById = actor.userId;

      const [rows, total] = await Promise.all([
        prisma.personChangeRequest.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (filters.page - 1) * filters.limit,
          take: filters.limit,
          include: { requestedBy: { select: requestedBySelect } },
        }),
        prisma.personChangeRequest.count({ where }),
      ]);
      return {
        data: rows.map(mapChangeRequestRow),
        meta: buildPaginationMeta(total, filters.page, filters.limit),
      };
    }

    // Con documento: resolver entidades + pendientes de ese documento
    const documentoKey = normalizeDocumentoKey(documento);
    const pendingWhere: Prisma.PersonChangeRequestWhereInput = {
      status: statusFilter ?? 'PENDING',
    };
    if (mineOnly) pendingWhere.requestedById = actor.userId;

    const [persons, companies, allPending] = await Promise.all([
      prisma.person.findMany({
        where: {
          OR: [
            { cedula: { contains: documento, mode: 'insensitive' } },
            { documentNumber: { contains: documento, mode: 'insensitive' } },
          ],
        },
        select: { id: true, entityId: true, cedula: true, documentNumber: true },
        take: 200,
      }),
      prisma.company.findMany({
        where: { ruc: { contains: documento, mode: 'insensitive' } },
        select: { entityId: true, ruc: true },
        take: 200,
      }),
      prisma.personChangeRequest.findMany({
        where: pendingWhere,
        orderBy: { createdAt: 'desc' },
        take: 500,
        include: { requestedBy: { select: requestedBySelect } },
      }),
    ]);

    const entityIdSet = new Set<string>();
    const personIdSet = new Set<string>();

    for (const person of persons) {
      const key = normalizeDocumentoKey(person.documentNumber || person.cedula || '');
      const raw = (person.documentNumber || person.cedula || '').trim();
      if (
        raw === documento ||
        raw.toUpperCase() === documento.toUpperCase() ||
        (documentoKey && key === documentoKey) ||
        (documentoKey && key.includes(documentoKey))
      ) {
        entityIdSet.add(person.entityId);
        personIdSet.add(person.id);
      }
    }
    for (const company of companies) {
      const key = normalizeDocumentoKey(company.ruc || '');
      const raw = (company.ruc || '').trim();
      if (
        raw === documento ||
        raw.toUpperCase() === documento.toUpperCase() ||
        (documentoKey && key === documentoKey) ||
        (documentoKey && key.includes(documentoKey))
      ) {
        entityIdSet.add(company.entityId);
      }
    }

    if (entityIdSet.size === 0 && documentoKey.length >= 4) {
      const normalizedRows = await prisma.$queryRaw<Array<{ entity_id: string; person_id: string | null }>>`
        SELECT p.entity_id::text AS entity_id, p.id::text AS person_id
        FROM persons p
        WHERE regexp_replace(upper(coalesce(p.document_number, p.cedula, '')), '[^0-9A-Z]', '', 'g') = ${documentoKey}
        UNION ALL
        SELECT c.entity_id::text AS entity_id, NULL::text AS person_id
        FROM companies c
        WHERE regexp_replace(upper(coalesce(c.ruc, '')), '[^0-9A-Z]', '', 'g') = ${documentoKey}
      `;
      for (const row of normalizedRows) {
        entityIdSet.add(row.entity_id);
        if (row.person_id) personIdSet.add(row.person_id);
      }
    }

    const matched = allPending.filter((row) => {
      if (row.entityId && entityIdSet.has(row.entityId)) return true;
      if (row.personId && personIdSet.has(row.personId)) return true;
      return payloadMentionsDocumento(row.payload, documento, documentoKey);
    });

    const total = matched.length;
    const start = (filters.page - 1) * filters.limit;
    const data = matched.slice(start, start + filters.limit).map(mapChangeRequestRow);

    return {
      data,
      meta: buildPaginationMeta(total, filters.page, filters.limit),
    };
  },

  async confirm(id: string, actor: AuditActor) {
    const row = await prisma.personChangeRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Solicitud de cambio', id);
    if (row.status !== 'PENDING') {
      throw new BadRequestError('La solicitud ya no está pendiente');
    }

    let applied: unknown = null;
    const applyPayload = unwrapApplyPayload(row.payload);
    const entityKind = payloadEntityKind(row.payload);

    if (row.action === 'CREATE') {
      if (entityKind === 'COMPANY') {
        applied = await companyService.create(applyPayload as CreateCompanyInput, actor);
      } else {
        applied = await personService.create(applyPayload as CreatePersonInput, actor);
      }
    } else if (row.action === 'UPDATE') {
      if (!row.entityId) throw new BadRequestError('Solicitud UPDATE sin entityId');
      if (entityKind === 'COMPANY') {
        applied = await companyService.update(
          row.entityId,
          applyPayload as UpdateCompanyInput,
          actor
        );
      } else {
        applied = await personService.update(
          row.entityId,
          applyPayload as UpdatePersonInput,
          actor
        );
      }
    } else if (row.action === 'DELETE') {
      if (!row.entityId) throw new BadRequestError('Solicitud DELETE sin entityId');
      if (entityKind === 'COMPANY') {
        applied = await companyService.remove(row.entityId, actor);
      } else {
        applied = await personService.remove(row.entityId, actor);
      }
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
    const auditAction =
      row.action === 'CREATE' ? 'CREATE' : row.action === 'DELETE' ? 'DELETE' : 'UPDATE';

    await auditService.log({
      action: auditAction,
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
