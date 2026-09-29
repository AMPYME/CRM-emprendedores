/**
 * Service del módulo de entidades.
 * Lógica de negocio para búsqueda cross-type y detalle.
 */
import { prisma } from '../../config/database';
import { entityRepository } from './entity.repository';
import { EntityQueryInput, RegistroEmpresarialInput } from './entity.validator';
import { BadRequestError, NotFoundError } from '../../shared/errors/app-error';
import { PaginationMeta } from '../../shared/types/api-response.types';
import { auditService, AuditActor } from '../audit/audit.service';
import { actorContext } from '../audit/audit-snapshot';

function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

export const entityService = {
  /**
   * Listado paginado con búsqueda cross-type (personas, empresas, establecimientos).
   */
  async list(filters: EntityQueryInput) {
    const result = await entityRepository.findAll(filters);
    return {
      data: result.data,
      meta: buildPaginationMeta(result.total, result.page, result.limit),
    };
  },

  /**
   * Detalle completo de una entidad (cualquier tipo) con conteos de relaciones.
   */
  async getById(id: string) {
    const entity = await entityRepository.findById(id);
    if (!entity) {
      throw new NotFoundError('Entidad', id);
    }
    return entity;
  },

  /**
   * Asigna o quita la fecha de registro empresarial.
   * null significa que la entidad nunca ha tenido registro.
   */
  async setRegistroEmpresarialFecha(id: string, input: RegistroEmpresarialInput, actor?: AuditActor) {
    const entity = await entityRepository.findById(id);
    if (!entity) {
      throw new NotFoundError('Entidad', id);
    }
    const anterior = entity.registroEmpresarialFecha
      ? entity.registroEmpresarialFecha.toISOString().slice(0, 10)
      : null;
    const updated = await entityRepository.setRegistroEmpresarialFecha(id, input.fecha);
    const quien = await actorContext(actor);
    await auditService.log({
      action: 'UPDATE',
      entityType: entity.entityType,
      entityId: entity.id,
      entityLabel: entity.displayName,
      userId: actor?.userId,
      userEmail: actor?.userEmail,
      metadata: {
        ...quien,
        anterior: { registroEmpresarialFecha: anterior },
        nuevo: { registroEmpresarialFecha: input.fecha },
      },
    });
    return updated;
  },

  async verificarDocumento(documento: string) {
    const value = documento.trim();
    if (!value) {
      throw new BadRequestError('Indique una cédula o un RUC');
    }

    const [person, company] = await Promise.all([
      prisma.entity.findFirst({
        where: {
          entityType: 'PERSON',
          status: { not: 'MERGED' },
          person: { cedula: value },
        },
        select: {
          id: true,
          displayName: true,
          entityType: true,
          registroEmpresarialFecha: true,
        },
      }),
      prisma.entity.findFirst({
        where: {
          entityType: 'COMPANY',
          status: { not: 'MERGED' },
          company: { ruc: value },
        },
        select: {
          id: true,
          displayName: true,
          entityType: true,
          registroEmpresarialFecha: true,
        },
      }),
    ]);

    return [person, company].filter((row): row is NonNullable<typeof row> => row !== null);
  },

  async historial(entityId: string, page: number, limit: number) {
    const entity = await prisma.entity.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        createdAt: true,
        sourceOrigin: true,
        createdBy: {
          select: {
            username: true,
            sede: { select: { name: true } },
            departamento: { select: { name: true } },
          },
        },
      },
    });
    if (!entity) {
      throw new NotFoundError('Entidad', entityId);
    }

    const [logs, rango, alta] = await Promise.all([
      auditService.listByEntity(entityId, page, limit),
      prisma.auditLog.aggregate({
        where: { entityId },
        _min: { createdAt: true },
        _max: { createdAt: true },
        _count: true,
      }),
      prisma.auditLog.findFirst({
        where: { entityId, action: 'CREATE', entityType: { in: ['PERSON', 'COMPANY'] } },
        select: { id: true },
      }),
    ]);

    const usuarioDe = (username?: string | null) => {
      const raw = username?.trim() || '';
      if (!raw || raw.includes('@')) return null;
      return raw;
    };
    const tieneAlta = Boolean(alta);
    const fechas = [entity.createdAt, rango._min.createdAt, rango._max.createdAt].filter(
      (fecha): fecha is Date => fecha instanceof Date,
    );
    const desde = fechas.reduce((min, fecha) => (fecha < min ? fecha : min), fechas[0]);
    const hasta = fechas.reduce((max, fecha) => (fecha > max ? fecha : max), fechas[0]);

    return {
      introduccion: {
        fecha: entity.createdAt,
        origen: entity.sourceOrigin,
        usuario: usuarioDe(entity.createdBy?.username),
        sede: entity.createdBy?.sede?.name ?? null,
        departamento: entity.createdBy?.departamento?.name ?? null,
      },
      resumen: {
        total: rango._count + (tieneAlta ? 0 : 1),
        desde,
        hasta,
        tieneAlta,
      },
      data: logs.data,
      meta: logs.meta,
    };
  },
};
