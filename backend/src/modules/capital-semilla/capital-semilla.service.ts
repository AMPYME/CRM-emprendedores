/**
 * Capital semilla histórico, vinculado a la persona por cédula.
 * Nombre y apellido no se consultan ni se devuelven.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/app-error';
import { auditService, AuditActor } from '../audit/audit.service';
import { SaveCapitalSemillaInput } from './capital-semilla.validator';

export function cedulaKey(value: string): string {
  return value.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export const capitalSemillaService = {
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
      await auditService.log({
        action: 'UPDATE',
        entityType: 'CAPITAL_SEMILLA',
        entityId,
        entityLabel: person.entity.displayName,
        userId: actor?.userId,
        userEmail: actor?.userEmail,
        metadata: {
          recordId: updated.id,
          cedula: updated.cedula,
          province: updated.province,
          businessName: updated.businessName,
          actaNumber: updated.actaNumber,
          amount: updated.amount === null ? null : updated.amount.toString(),
        },
      });
      return toRecord(updated);
    }

    if (matches.length > 0) {
      throw new ConflictError('Esta persona ya tiene capital semilla. Edite el registro existente.');
    }

    const created = await prisma.capitalSemilla.create({
      data: { ...fields, personId: person.id },
    });
    await auditService.log({
      action: 'CREATE',
      entityType: 'CAPITAL_SEMILLA',
      entityId,
      entityLabel: person.entity.displayName,
      userId: actor?.userId,
      userEmail: actor?.userEmail,
      metadata: {
        recordId: created.id,
        cedula: created.cedula,
        province: created.province,
        businessName: created.businessName,
        actaNumber: created.actaNumber,
        amount: created.amount === null ? null : created.amount.toString(),
      },
    });
    return toRecord(created);
  },
};

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
}) {
  return {
    id: row.id,
    externalId: row.externalId,
    cedula: row.cedula,
    province: row.province,
    businessName: row.businessName,
    actaNumber: row.actaNumber,
    amount: row.amount === null ? null : row.amount.toString(),
  };
}
