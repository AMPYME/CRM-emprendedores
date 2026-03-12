/**
 * Repository del módulo de entidades.
 * Queries Prisma para búsqueda cross-type y detalle de entidades.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { EntityQueryInput } from './entity.validator';
import {
  EntityWithRelations,
  EntityDetail,
  ENTITY_LIST_INCLUDES,
  ENTITY_DETAIL_INCLUDES,
} from '../../shared/types/entity.types';
import { PaginatedResult } from '../../shared/types/api-response.types';

function buildOrderBy(
  sortBy: string | undefined,
  sortOrder: 'asc' | 'desc'
): Prisma.EntityOrderByWithRelationInput {
  const map: Record<string, Prisma.EntityOrderByWithRelationInput> = {
    displayName: { displayName: sortOrder },
    createdAt: { createdAt: sortOrder },
    updatedAt: { updatedAt: sortOrder },
    province: { province: sortOrder },
  };
  return map[sortBy || ''] || { createdAt: sortOrder };
}

export const entityRepository = {
  /**
   * Listado paginado con filtros y búsqueda cross-type.
   */
  async findAll(filters: EntityQueryInput): Promise<PaginatedResult<EntityWithRelations>> {
    const where: Prisma.EntityWhereInput = {};

    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.status) where.status = filters.status;
    else where.status = { not: 'MERGED' };
    if (filters.province) where.province = { contains: filters.province, mode: 'insensitive' };

    // Búsqueda unificada: nombre, cédula, RUC, contacto, nombre de negocio
    if (filters.search) {
      where.OR = [
        { displayName: { contains: filters.search, mode: 'insensitive' } },
        { person: { cedula: { contains: filters.search } } },
        { person: { firstName: { contains: filters.search, mode: 'insensitive' } } },
        { person: { lastName: { contains: filters.search, mode: 'insensitive' } } },
        { person: { businessName: { contains: filters.search, mode: 'insensitive' } } },
        { company: { ruc: { contains: filters.search } } },
        { company: { legalName: { contains: filters.search, mode: 'insensitive' } } },
        { company: { tradeName: { contains: filters.search, mode: 'insensitive' } } },
        { establishment: { establishmentName: { contains: filters.search, mode: 'insensitive' } } },
        { contacts: { some: { contactValue: { contains: filters.search, mode: 'insensitive' } } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.entity.findMany({
        where,
        include: ENTITY_LIST_INCLUDES,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: buildOrderBy(filters.sortBy, filters.sortOrder),
      }),
      prisma.entity.count({ where }),
    ]);

    return { data, total, page: filters.page, limit: filters.limit };
  },

  /**
   * Detalle completo de una entidad con conteos de relaciones.
   */
  async findById(id: string): Promise<EntityDetail | null> {
    return prisma.entity.findUnique({
      where: { id },
      include: ENTITY_DETAIL_INCLUDES,
    });
  },
};
