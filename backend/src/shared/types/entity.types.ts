/**
 * Tipos derivados de Prisma para entidades con relaciones incluidas.
 * Usados en repositories, services y controllers.
 */
import { Prisma } from '@prisma/client';

// ── Includes reutilizables ────────────────────────────────────────

export const ENTITY_LIST_INCLUDES = {
  person: true,
  company: true,
  establishment: true,
  contacts: true,
} satisfies Prisma.EntityInclude;

export const ENTITY_DETAIL_INCLUDES = {
  person: true,
  company: true,
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

export const PERSON_LIST_INCLUDES = {
  person: true,
  contacts: { orderBy: { isPrimary: 'desc' as const } },
} satisfies Prisma.EntityInclude;

export const COMPANY_LIST_INCLUDES = {
  company: true,
  contacts: { orderBy: { isPrimary: 'desc' as const } },
} satisfies Prisma.EntityInclude;

export const ESTABLISHMENT_LIST_INCLUDES = {
  establishment: true,
  contacts: { orderBy: { isPrimary: 'desc' as const } },
} satisfies Prisma.EntityInclude;

// ── Tipos de respuesta ────────────────────────────────────────────

/** Entity con todas las relaciones de tipo (para listado cross-type). */
export type EntityWithRelations = Prisma.EntityGetPayload<{
  include: typeof ENTITY_LIST_INCLUDES;
}>;

/** Entity con detalle completo (vista individual + conteos). */
export type EntityDetail = Prisma.EntityGetPayload<{
  include: typeof ENTITY_DETAIL_INCLUDES;
}>;

/** Entity con datos de persona. */
export type EntityWithPerson = Prisma.EntityGetPayload<{
  include: typeof PERSON_LIST_INCLUDES;
}>;

/** Entity con datos de empresa. */
export type EntityWithCompany = Prisma.EntityGetPayload<{
  include: typeof COMPANY_LIST_INCLUDES;
}>;

/** Entity con datos de establecimiento. */
export type EntityWithEstablishment = Prisma.EntityGetPayload<{
  include: typeof ESTABLISHMENT_LIST_INCLUDES;
}>;
