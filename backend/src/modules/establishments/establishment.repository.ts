/**
 * Repository del módulo de establecimientos.
 * Queries Prisma para CRUD de establecimientos.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { EstablishmentQueryInput } from './establishment.validator';
import {
  EntityWithEstablishment,
  ESTABLISHMENT_LIST_INCLUDES,
} from '../../shared/types/entity.types';
import { PaginatedResult } from '../../shared/types/api-response.types';

const detailIncludes = {
  establishment: true,
  contacts: { orderBy: { isPrimary: 'desc' as const } },
  _count: {
    select: {
      relationshipsFrom: true,
      relationshipsTo: true,
      eventRegistrations: true,
      portfolioRecords: true,
    },
  },
} satisfies Prisma.EntityInclude;

function buildOrderBy(
  sortBy: string | undefined,
  sortOrder: 'asc' | 'desc'
): Prisma.EntityOrderByWithRelationInput {
  const map: Record<string, Prisma.EntityOrderByWithRelationInput> = {
    displayName: { displayName: sortOrder },
    createdAt: { createdAt: sortOrder },
    establishmentName: { establishment: { establishmentName: sortOrder } },
    economicActivity: { establishment: { economicActivity: sortOrder } },
  };
  return map[sortBy || ''] || { createdAt: sortOrder };
}

export const establishmentRepository = {
  async findAll(filters: EstablishmentQueryInput): Promise<PaginatedResult<EntityWithEstablishment>> {
    const where: Prisma.EntityWhereInput = {
      entityType: 'ESTABLISHMENT',
    };

    if (filters.status) where.status = filters.status;
    else where.status = { not: 'MERGED' };

    if (filters.province) where.province = { contains: filters.province, mode: 'insensitive' };

    const estabWhere: Prisma.EstablishmentWhereInput = {};
    if (filters.establishmentType) {
      estabWhere.establishmentType = { contains: filters.establishmentType, mode: 'insensitive' };
    }
    if (filters.economicActivity) {
      estabWhere.economicActivity = { contains: filters.economicActivity, mode: 'insensitive' };
    }
    if (Object.keys(estabWhere).length > 0) where.establishment = estabWhere;

    if (filters.search) {
      where.OR = [
        { displayName: { contains: filters.search, mode: 'insensitive' } },
        { establishment: { establishmentName: { contains: filters.search, mode: 'insensitive' } } },
        { establishment: { economicActivity: { contains: filters.search, mode: 'insensitive' } } },
        { establishment: { noticeOfOperation: { contains: filters.search } } },
        { contacts: { some: { contactValue: { contains: filters.search, mode: 'insensitive' } } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.entity.findMany({
        where,
        include: ESTABLISHMENT_LIST_INCLUDES,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: buildOrderBy(filters.sortBy, filters.sortOrder),
      }),
      prisma.entity.count({ where }),
    ]);

    return { data, total, page: filters.page, limit: filters.limit };
  },

  async findById(entityId: string) {
    return prisma.entity.findFirst({
      where: { id: entityId, entityType: 'ESTABLISHMENT' },
      include: detailIncludes,
    });
  },

  async create(data: {
    displayName: string;
    province?: string;
    district?: string;
    corregimiento?: string;
    address?: string;
    notes?: string;
    sourceOrigin: string;
    establishment: Prisma.EstablishmentCreateWithoutEntityInput;
    contacts?: Array<{ contactType: string; contactValue: string; label?: string; isPrimary?: boolean }>;
  }): Promise<EntityWithEstablishment> {
    return prisma.entity.create({
      data: {
        entityType: 'ESTABLISHMENT',
        status: 'ACTIVE',
        displayName: data.displayName,
        province: data.province,
        district: data.district,
        corregimiento: data.corregimiento,
        address: data.address,
        notes: data.notes,
        sourceOrigin: data.sourceOrigin,
        establishment: { create: data.establishment },
        contacts: data.contacts?.length
          ? { create: data.contacts as Prisma.EntityContactCreateWithoutEntityInput[] }
          : undefined,
      },
      include: ESTABLISHMENT_LIST_INCLUDES,
    });
  },

  async update(
    entityId: string,
    entityData: Prisma.EntityUpdateInput,
    estabData?: Prisma.EstablishmentUpdateWithoutEntityInput
  ): Promise<EntityWithEstablishment> {
    const updateData: Prisma.EntityUpdateInput = { ...entityData };
    if (estabData && Object.keys(estabData).length > 0) {
      updateData.establishment = { update: estabData };
    }

    return prisma.entity.update({
      where: { id: entityId },
      data: updateData,
      include: ESTABLISHMENT_LIST_INCLUDES,
    });
  },

  async softDelete(entityId: string): Promise<EntityWithEstablishment> {
    return prisma.entity.update({
      where: { id: entityId },
      data: { status: 'INACTIVE' },
      include: ESTABLISHMENT_LIST_INCLUDES,
    });
  },
};
