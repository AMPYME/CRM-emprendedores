/**
 * Capital semilla histórico, vinculado a la persona por cédula.
 * Nombre y apellido no se consultan ni se devuelven.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/app-error';
import { auditService, AuditActor } from '../audit/audit.service';
import { actorContext, cambios } from '../audit/audit-snapshot';
import { SaveCapitalSemillaInput, CapitalSemillaQueryInput, LinkCapitalSemillaInput } from './capital-semilla.validator';

export function cedulaKey(value: string): string {
  return value.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export const capitalSemillaService = {
  async list(filters: CapitalSemillaQueryInput) {
    const where: Prisma.CapitalSemillaWhereInput = {};
    if (filters.search) {
      where.OR = [
        { cedula: { contains: filters.search, mode: 'insensitive' } },
        { businessName: { contains: filters.search, mode: 'insensitive' } },
        { actaNumber: { contains: filters.search, mode: 'insensitive' } },
        { province: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.linked === 'yes') where.personId = { not: null };
    if (filters.linked === 'no') where.personId = null;

    const [rows, total] = await Promise.all([
      prisma.capitalSemilla.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: {
          person: {
            select: {
              id: true,
              entityId: true,
              firstName: true,
              lastName: true,
              documentNumber: true,
              cedula: true,
              entity: { select: { entityType: true, displayName: true, status: true } },
            },
          },
        },
      }),
      prisma.capitalSemilla.count({ where }),
    ]);

    const totalPages = Math.ceil(total / filters.limit) || 1;
    return {
      data: rows.map((row) => ({
        ...toRecord(row),
        linkedAt: row.linkedAt ? row.linkedAt.toISOString().slice(0, 10) : null,
        person: row.person
          ? {
              id: row.person.id,
              entityId: row.person.entityId,
              displayName: row.person.entity.displayName,
              entityType: row.person.entity.entityType,
              documentNumber: row.person.documentNumber || row.person.cedula,
            }
          : null,
      })),
      meta: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages,
        hasNextPage: filters.page < totalPages,
        hasPrevPage: filters.page > 1,
      },
    };
  },

  /**
   * Vincula un registro a una PERSON (nunca COMPANY) con fecha de vínculo (sin vencimiento).
   */
  async link(recordId: string, input: LinkCapitalSemillaInput, actor?: AuditActor) {
    const record = await prisma.capitalSemilla.findUnique({ where: { id: recordId } });
    if (!record) throw new NotFoundError('Capital semilla', recordId);

    const person = await prisma.person.findUnique({
      where: { id: input.personId },
      include: { entity: { select: { id: true, entityType: true, displayName: true, status: true } } },
    });
    if (!person) throw new NotFoundError('Persona', input.personId);
    if (person.entity.entityType !== 'PERSON') {
      throw new BadRequestError('Solo se puede vincular Capital Semilla a entidades de tipo PERSON');
    }
    if (person.entity.status === 'INACTIVE') {
      throw new BadRequestError('La persona está inactiva');
    }

    const linkedAt = new Date(input.linkedAt);
    if (Number.isNaN(linkedAt.getTime())) {
      throw new BadRequestError('Fecha de vínculo inválida');
    }

    const owned = await prisma.capitalSemilla.findUnique({ where: { personId: person.id } });
    if (owned && owned.id !== recordId) {
      throw new ConflictError('Esa persona ya tiene otro registro de capital semilla vinculado');
    }

    const updated = await prisma.capitalSemilla.update({
      where: { id: recordId },
      data: {
        personId: person.id,
        linkedAt,
        cedula: person.cedula || person.documentNumber || record.cedula,
        cedulaKey: cedulaKey(person.cedula || person.documentNumber || record.cedula),
      },
    });

    const quien = await actorContext(actor);
    await auditService.log({
      action: 'UPDATE',
      entityType: 'CAPITAL_SEMILLA',
      entityId: person.entityId,
      entityLabel: person.entity.displayName,
      userId: actor?.userId,
      userEmail: actor?.userEmail,
      metadata: {
        ...quien,
        anterior: { personId: record.personId, linkedAt: record.linkedAt },
        nuevo: { personId: updated.personId, linkedAt: updated.linkedAt },
      },
    });

    return {
      ...toRecord(updated),
      linkedAt: updated.linkedAt ? updated.linkedAt.toISOString().slice(0, 10) : null,
    };
  },

  /**
   * Busca persona por cédula (solo PERSON) y devuelve su fecha de capital semilla.
   */
  async verificarCedula(documento: string) {
    const value = documento.trim();
    if (!value) throw new BadRequestError('Indique una cédula');

    const persons = await prisma.person.findMany({
      where: {
        entity: { entityType: 'PERSON', status: { not: 'MERGED' } },
        OR: [{ cedula: value }, { documentNumber: value }],
      },
      select: {
        id: true,
        entityId: true,
        cedula: true,
        documentNumber: true,
        entity: { select: { id: true, displayName: true, entityType: true } },
        capitalSemilla: { select: { id: true, linkedAt: true } },
      },
      take: 10,
    });

    return persons.map((p) => ({
      id: p.entity.id,
      personId: p.id,
      displayName: p.entity.displayName,
      entityType: 'PERSON' as const,
      cedula: p.documentNumber || p.cedula,
      linkedAt: p.capitalSemilla?.linkedAt
        ? p.capitalSemilla.linkedAt.toISOString().slice(0, 10)
        : null,
      capitalSemillaId: p.capitalSemilla?.id ?? null,
    }));
  },

  /**
   * Asigna o quita la fecha de capital semilla de una persona (por entityId).
   * null = sin capital semilla vinculado.
   */
  async setLinkedAtByEntity(entityId: string, linkedAt: string | null, actor?: AuditActor) {
    const person = await prisma.person.findUnique({
      where: { entityId },
      include: {
        entity: { select: { id: true, displayName: true, entityType: true, status: true } },
        capitalSemilla: true,
      },
    });
    if (!person) throw new NotFoundError('Persona', entityId);
    if (person.entity.entityType !== 'PERSON') {
      throw new BadRequestError('Capital Semilla solo aplica a personas');
    }
    if (person.entity.status === 'INACTIVE') {
      throw new BadRequestError('La persona está inactiva');
    }

    const doc = person.cedula || person.documentNumber;
    if (!doc?.trim()) {
      throw new BadRequestError('La persona necesita cédula para capital semilla');
    }
    const key = cedulaKey(doc);
    const anterior = person.capitalSemilla?.linkedAt
      ? person.capitalSemilla.linkedAt.toISOString().slice(0, 10)
      : null;

    if (linkedAt === null) {
      if (person.capitalSemilla) {
        await prisma.capitalSemilla.update({
          where: { id: person.capitalSemilla.id },
          data: { personId: null, linkedAt: null },
        });
      }
      const quien = await actorContext(actor);
      await auditService.log({
        action: 'UPDATE',
        entityType: 'CAPITAL_SEMILLA',
        entityId: person.entityId,
        entityLabel: person.entity.displayName,
        userId: actor?.userId,
        userEmail: actor?.userEmail,
        metadata: {
          ...quien,
          anterior: { linkedAt: anterior },
          nuevo: { linkedAt: null },
        },
      });
      return {
        id: person.entityId,
        personId: person.id,
        displayName: person.entity.displayName,
        entityType: 'PERSON' as const,
        linkedAt: null,
      };
    }

    const date = new Date(`${linkedAt}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestError('Fecha de capital semilla inválida');
    }

    let recordId = person.capitalSemilla?.id;
    if (!recordId) {
      const byKey = await prisma.capitalSemilla.findFirst({
        where: { cedulaKey: key, personId: null },
        orderBy: { createdAt: 'asc' },
      });
      recordId = byKey?.id;
    }

    let updated;
    if (recordId) {
      updated = await prisma.capitalSemilla.update({
        where: { id: recordId },
        data: {
          personId: person.id,
          linkedAt: date,
          cedula: doc.trim(),
          cedulaKey: key,
        },
      });
    } else {
      updated = await prisma.capitalSemilla.create({
        data: {
          cedula: doc.trim(),
          cedulaKey: key,
          personId: person.id,
          linkedAt: date,
        },
      });
    }

    const quien = await actorContext(actor);
    await auditService.log({
      action: 'UPDATE',
      entityType: 'CAPITAL_SEMILLA',
      entityId: person.entityId,
      entityLabel: person.entity.displayName,
      userId: actor?.userId,
      userEmail: actor?.userEmail,
      metadata: {
        ...quien,
        anterior: { linkedAt: anterior },
        nuevo: { linkedAt },
      },
    });

    return {
      id: person.entityId,
      personId: person.id,
      displayName: person.entity.displayName,
      entityType: 'PERSON' as const,
      linkedAt: updated.linkedAt ? updated.linkedAt.toISOString().slice(0, 10) : null,
    };
  },

  async listByPerson(entityId: string) {
    const person = await prisma.person.findUnique({
      where: { entityId },
      select: { cedula: true },
    });
    if (!person) throw new NotFoundError('Persona', entityId);

    const key = cedulaKey(person.cedula ?? '');
    if (!key) {
      return { cedula: person.cedula, records: [] };
    }

    const rows = await prisma.capitalSemilla.findMany({
      where: { cedulaKey: key },
      orderBy: [{ actaNumber: 'asc' }, { externalId: 'asc' }],
      select: {
        id: true,
        externalId: true,
        cedula: true,
        province: true,
        businessName: true,
        actaNumber: true,
        amount: true,
      },
    });

    return {
      cedula: person.cedula,
      records: rows.map(toRecord),
    };
  },

  /**
   * Alta o edición del único registro de la persona.
   * Operador y admin. Si ya hay registros de esa cédula, no se crea otro.
   */
  async save(entityId: string, input: SaveCapitalSemillaInput, actor?: AuditActor) {
    const pending = await prisma.personChangeRequest.findFirst({
      where: { entityId, status: 'PENDING' },
      select: { id: true },
    });
    if (pending) {
      throw new BadRequestError(
        'Esta entidad tiene cambios pendientes de confirmación. Confírmelos o cancele antes de editar.'
      );
    }
    const person = await prisma.person.findUnique({
      where: { entityId },
      select: {
        id: true,
        cedula: true,
        entity: { select: { displayName: true } },
      },
    });
    if (!person) throw new NotFoundError('Persona', entityId);

    const key = cedulaKey(person.cedula ?? '');
    if (!person.cedula || !key) {
      throw new BadRequestError('La persona necesita cédula para registrar capital semilla');
    }

    const fields = {
      cedula: person.cedula.trim(),
      cedulaKey: key,
      province: emptyToNull(input.province),
      businessName: emptyToNull(input.businessName),
      actaNumber: emptyToNull(input.actaNumber),
      amount: parseAmount(input.amount),
    };

    const owned = await prisma.capitalSemilla.findUnique({ where: { personId: person.id } });
    const matches = await prisma.capitalSemilla.findMany({
      where: { cedulaKey: key },
      select: { id: true },
    });

    let recordId = input.recordId ?? owned?.id;
    if (!recordId && matches.length === 1) recordId = matches[0].id;

    if (recordId) {
      const current = await prisma.capitalSemilla.findFirst({
        where: { id: recordId, OR: [{ personId: person.id }, { cedulaKey: key }] },
      });
      if (!current) throw new NotFoundError('Capital semilla', recordId);
      if (current.personId && current.personId !== person.id) {
        throw new ConflictError('Ese registro de capital semilla pertenece a otra persona');
      }
      const updated = await prisma.capitalSemilla.update({
        where: { id: current.id },
        data: {
          ...fields,
          personId: !owned || owned.id === current.id ? person.id : current.personId,
        },
      });
      const quien = await actorContext(actor);
      const { anterior, nuevo } = cambios(vistaCapital(current), vistaCapital(updated));
      await auditService.log({
        action: 'UPDATE',
        entityType: 'CAPITAL_SEMILLA',
        entityId,
        entityLabel: person.entity.displayName,
        userId: actor?.userId,
        userEmail: actor?.userEmail,
        metadata: { ...quien, anterior, nuevo },
      });
      return toRecord(updated);
    }

    if (matches.length > 0) {
      throw new ConflictError('Esta persona ya tiene capital semilla. Edite el registro existente.');
    }

    const created = await prisma.capitalSemilla.create({
      data: { ...fields, personId: person.id },
    });
    const quien = await actorContext(actor);
    await auditService.log({
      action: 'CREATE',
      entityType: 'CAPITAL_SEMILLA',
      entityId,
      entityLabel: person.entity.displayName,
      userId: actor?.userId,
      userEmail: actor?.userEmail,
      metadata: {
        ...quien,
        anterior: null,
        nuevo: vistaCapital(created),
      },
    });
    return toRecord(created);
  },
};

function vistaCapital(row: {
  province: string | null;
  businessName: string | null;
  actaNumber: string | null;
  amount: Prisma.Decimal | null;
}) {
  return {
    province: row.province,
    businessName: row.businessName,
    actaNumber: row.actaNumber,
    amount: row.amount === null ? null : row.amount.toString(),
  };
}

function emptyToNull(value: string | null | undefined): string | null {
  const text = value?.trim() ?? '';
  return text || null;
}

function parseAmount(value: number | string | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim().replace(/\s/g, '');
  if (!raw) return null;
  const normalized = raw.includes(',') && !raw.includes('.')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(/,/g, '');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new BadRequestError('El monto de capital semilla no es válido');
  }
  return new Prisma.Decimal(parsed.toFixed(2));
}

function toRecord(row: {
  id: string;
  externalId: number | null;
  cedula: string;
  province: string | null;
  businessName: string | null;
  actaNumber: string | null;
  amount: Prisma.Decimal | null;
  personId?: string | null;
  linkedAt?: Date | null;
}) {
  return {
    id: row.id,
    externalId: row.externalId,
    cedula: row.cedula,
    province: row.province,
    businessName: row.businessName,
    actaNumber: row.actaNumber,
    amount: row.amount === null ? null : row.amount.toString(),
    personId: row.personId ?? null,
    linkedAt: row.linkedAt ? row.linkedAt.toISOString().slice(0, 10) : null,
  };
}
