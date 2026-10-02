/**
 * Repository del módulo de personas.
 * Queries Prisma para CRUD de personas.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { PersonQueryInput, CreatePersonInput } from './person.validator';
import { toProvinciaCode, toDistritoCode, toCorregimientoCode } from '../../shared/utils/division-politica';
import {
  EntityWithPerson,
  PERSON_LIST_INCLUDES,
} from '../../shared/types/entity.types';
import { PaginatedResult } from '../../shared/types/api-response.types';

const detailIncludes = {
  person: true,
  contacts: { where: { deletedAt: null }, orderBy: { isPrimary: 'desc' as const } },
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
    firstName: { person: { firstName: sortOrder } },
    lastName: { person: { lastName: sortOrder } },
    cedula: { person: { cedula: sortOrder } },
  };
  return map[sortBy || ''] || { createdAt: sortOrder };
}

export const personRepository = {
  /**
   * Listado paginado de personas con filtros.
   */
  async findAll(filters: PersonQueryInput): Promise<PaginatedResult<EntityWithPerson>> {
    const where: Prisma.EntityWhereInput = {
      entityType: 'PERSON',
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

    // Filtros específicos de persona
    const personWhere: Prisma.PersonWhereInput = {};
    if (filters.cedula) personWhere.cedula = { contains: filters.cedula };
    if (filters.gender) personWhere.gender = filters.gender;
    if (filters.economicActivity) {
      personWhere.economicActivity = { contains: filters.economicActivity, mode: 'insensitive' };
    }
    if (filters.hasArtisanCard !== undefined) {
      personWhere.hasArtisanCard = filters.hasArtisanCard;
    }
    if (filters.seedCapital !== undefined) {
      personWhere.seedCapital = filters.seedCapital;
    }
    if (Object.keys(personWhere).length > 0) where.person = personWhere;

    // Búsqueda por nombre, cédula, negocio, contacto
    if (filters.search) {
      where.OR = [
        { displayName: { contains: filters.search, mode: 'insensitive' } },
        { person: { cedula: { contains: filters.search } } },
        { person: { firstName: { contains: filters.search, mode: 'insensitive' } } },
        { person: { lastName: { contains: filters.search, mode: 'insensitive' } } },
        { person: { businessName: { contains: filters.search, mode: 'insensitive' } } },
        { contacts: { some: { deletedAt: null, contactValue: { contains: filters.search, mode: 'insensitive' } } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.entity.findMany({
        where,
        include: PERSON_LIST_INCLUDES,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: buildOrderBy(filters.sortBy, filters.sortOrder),
      }),
      prisma.entity.count({ where }),
    ]);

    return { data, total, page: filters.page, limit: filters.limit };
  },

  /**
   * Detalle de una persona por entity ID.
   */
  async findById(entityId: string) {
    return prisma.entity.findFirst({
      where: { id: entityId, entityType: 'PERSON' },
      include: detailIncludes,
    });
  },

  /**
   * Busca persona por cédula (para deduplicación básica).
   */
  async findByCedula(cedula: string) {
    return prisma.entity.findFirst({
      where: {
        entityType: 'PERSON',
        status: { not: 'MERGED' },
        person: { cedula },
      },
      include: PERSON_LIST_INCLUDES,
    });
  },

  /**
   * Crea entidad + persona + contactos en una transacción.
   */
  async create(data: {
    displayName: string;
    province?: string;
    district?: string;
    corregimiento?: string;
    address?: string;
    notes?: string;
    actEc?: string | null;
    sourceOrigin: string;
    createdById?: string;
    person: Prisma.PersonCreateWithoutEntityInput;
    contacts?: Array<{ contactType: string; contactValue: string; label?: string; isPrimary?: boolean }>;
  }): Promise<EntityWithPerson> {
    return prisma.entity.create({
      data: {
        entityType: 'PERSON',
        status: 'ACTIVE',
        displayName: data.displayName,
        province: data.province,
        district: data.district,
        corregimiento: data.corregimiento,
        address: data.address,
        notes: data.notes,
        actEc: data.actEc,
        sourceOrigin: data.sourceOrigin,
        createdById: data.createdById,
        person: { create: data.person },
        contacts: data.contacts?.length
          ? { create: data.contacts as Prisma.EntityContactCreateWithoutEntityInput[] }
          : undefined,
      },
      include: PERSON_LIST_INCLUDES,
    });
  },

  /**
   * Actualiza entidad + persona.
   */
  async update(
    entityId: string,
    entityData: Prisma.EntityUncheckedUpdateInput,
    personData?: Prisma.PersonUpdateWithoutEntityInput
  ): Promise<EntityWithPerson> {
    const updateData: Prisma.EntityUncheckedUpdateInput = { ...entityData };
    if (personData && Object.keys(personData).length > 0) {
      updateData.person = { update: personData };
    }

    return prisma.entity.update({
      where: { id: entityId },
      data: updateData,
      include: PERSON_LIST_INCLUDES,
    });
  },

  /**
   * Soft delete: cambia estado a INACTIVE.
   */
  async softDelete(entityId: string): Promise<EntityWithPerson> {
    return prisma.entity.update({
      where: { id: entityId },
      data: { status: 'INACTIVE' },
      include: PERSON_LIST_INCLUDES,
    });
  },
};
