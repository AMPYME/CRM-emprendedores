/**
 * Repository del módulo de empresas.
 * Queries Prisma para CRUD de empresas.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { CompanyQueryInput } from './company.validator';
import { toProvinciaCode, toDistritoCode, toCorregimientoCode } from '../../shared/utils/division-politica';
import {
  EntityWithCompany,
  COMPANY_LIST_INCLUDES,
} from '../../shared/types/entity.types';
import { PaginatedResult } from '../../shared/types/api-response.types';

const detailIncludes = {
  company: true,
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
    legalName: { company: { legalName: sortOrder } },
    tradeName: { company: { tradeName: sortOrder } },
    ruc: { company: { ruc: sortOrder } },
  };
  return map[sortBy || ''] || { createdAt: sortOrder };
}

export const companyRepository = {
  async findAll(filters: CompanyQueryInput): Promise<PaginatedResult<EntityWithCompany>> {
    const where: Prisma.EntityWhereInput = {
      entityType: 'COMPANY',
    };

    if (filters.status) where.status = filters.status;
    else where.status = { not: 'MERGED' };

    if (filters.province) {
      const code = toProvinciaCode(filters.province);
      if (code) where.province = code;
    }
    if (filters.district) {
      const code = toDistritoCode(filters.district, filters.province);
      if (code) where.district = code;
    }
    if (filters.corregimiento) {
      const code = toCorregimientoCode(filters.corregimiento, filters.district, filters.province);
      if (code) where.corregimiento = code;
    }

    const companyWhere: Prisma.CompanyWhereInput = {};
    if (filters.ruc) companyWhere.ruc = { contains: filters.ruc };
    if (filters.companyType) companyWhere.companyType = { contains: filters.companyType, mode: 'insensitive' };
    if (filters.companySizeClass) companyWhere.companySizeClass = filters.companySizeClass;
    if (Object.keys(companyWhere).length > 0) where.company = companyWhere;

    if (filters.search) {
      where.OR = [
        { displayName: { contains: filters.search, mode: 'insensitive' } },
        { company: { ruc: { contains: filters.search } } },
        { company: { legalName: { contains: filters.search, mode: 'insensitive' } } },
        { company: { tradeName: { contains: filters.search, mode: 'insensitive' } } },
        { contacts: { some: { contactValue: { contains: filters.search, mode: 'insensitive' } } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.entity.findMany({
        where,
        include: COMPANY_LIST_INCLUDES,
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
      where: { id: entityId, entityType: 'COMPANY' },
      include: detailIncludes,
    });
  },

  async findByRuc(ruc: string) {
    return prisma.entity.findFirst({
      where: {
        entityType: 'COMPANY',
        status: { not: 'MERGED' },
        company: { ruc },
      },
      include: COMPANY_LIST_INCLUDES,
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
    createdById?: string;
    company: Prisma.CompanyCreateWithoutEntityInput;
    contacts?: Array<{ contactType: string; contactValue: string; label?: string; isPrimary?: boolean }>;
  }): Promise<EntityWithCompany> {
    return prisma.entity.create({
      data: {
        entityType: 'COMPANY',
        status: 'ACTIVE',
        displayName: data.displayName,
        province: data.province,
        district: data.district,
        corregimiento: data.corregimiento,
        address: data.address,
        notes: data.notes,
        sourceOrigin: data.sourceOrigin,
        createdById: data.createdById,
        company: { create: data.company },
        contacts: data.contacts?.length
          ? { create: data.contacts as Prisma.EntityContactCreateWithoutEntityInput[] }
          : undefined,
      },
      include: COMPANY_LIST_INCLUDES,
    });
  },

  async update(
    entityId: string,
    entityData: Prisma.EntityUncheckedUpdateInput,
    companyData?: Prisma.CompanyUpdateWithoutEntityInput
  ): Promise<EntityWithCompany> {
    const updateData: Prisma.EntityUncheckedUpdateInput = { ...entityData };
    if (companyData && Object.keys(companyData).length > 0) {
      updateData.company = { update: companyData };
    }

    return prisma.entity.update({
      where: { id: entityId },
      data: updateData,
      include: COMPANY_LIST_INCLUDES,
    });
  },

  async softDelete(entityId: string): Promise<EntityWithCompany> {
    return prisma.entity.update({
      where: { id: entityId },
      data: { status: 'INACTIVE' },
      include: COMPANY_LIST_INCLUDES,
    });
  },
};
