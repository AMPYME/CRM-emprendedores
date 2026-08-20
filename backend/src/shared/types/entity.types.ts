/**
 * Tipos derivados de Prisma para entidades con relaciones incluidas.
 */
import { Prisma } from '@prisma/client';

export const ENTITY_LIST_INCLUDES = {
  person: true,
  company: true,
  contacts: true,
} satisfies Prisma.EntityInclude;

export const ENTITY_DETAIL_INCLUDES = {
  person: true,
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

export const PERSON_LIST_INCLUDES = {
  person: true,
  contacts: { orderBy: { isPrimary: 'desc' as const } },
} satisfies Prisma.EntityInclude;

export const COMPANY_LIST_INCLUDES = {
  company: true,
  contacts: { orderBy: { isPrimary: 'desc' as const } },
} satisfies Prisma.EntityInclude;

export type EntityWithRelations = Prisma.EntityGetPayload<{
  include: typeof ENTITY_LIST_INCLUDES;
}>;

export type EntityDetail = Prisma.EntityGetPayload<{
  include: typeof ENTITY_DETAIL_INCLUDES;
}>;

export type EntityWithPerson = Prisma.EntityGetPayload<{
  include: typeof PERSON_LIST_INCLUDES;
}>;

export type EntityWithCompany = Prisma.EntityGetPayload<{
  include: typeof COMPANY_LIST_INCLUDES;
}>;
