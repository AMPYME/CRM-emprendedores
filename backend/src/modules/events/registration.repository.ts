/**
 * Repository del módulo de inscripciones a eventos.
 * Queries Prisma para CRUD de EventRegistration + EventRegistrationAnswer.
 */
import { Prisma, EventRegistration } from '@prisma/client';
import { prisma } from '../../config/database';
import { RegistrationQueryInput } from './registration.validator';
import { PaginatedResult } from '../../shared/types/api-response.types';

// ── Includes reutilizables ────────────────────────────────────────

const REGISTRATION_LIST_INCLUDES = {
  entity: {
    select: {
      id: true,
      displayName: true,
      entityType: true,
      status: true,
    },
  },
  _count: {
    select: {
      answers: true,
    },
  },
} satisfies Prisma.EventRegistrationInclude;

const REGISTRATION_DETAIL_INCLUDES = {
  entity: {
    select: {
      id: true,
      displayName: true,
      entityType: true,
      status: true,
      province: true,
    },
  },
  event: {
    select: {
      id: true,
      name: true,
      slug: true,
      eventType: true,
      status: true,
    },
  },
  answers: {
    orderBy: { fieldKey: 'asc' as const },
  },
} satisfies Prisma.EventRegistrationInclude;

// ── Tipos derivados ───────────────────────────────────────────────

export type RegistrationWithEntity = Prisma.EventRegistrationGetPayload<{
  include: typeof REGISTRATION_LIST_INCLUDES;
}>;

export type RegistrationDetail = Prisma.EventRegistrationGetPayload<{
  include: typeof REGISTRATION_DETAIL_INCLUDES;
}>;

// ── Helpers ───────────────────────────────────────────────────────

function buildOrderBy(
  sortBy: string | undefined,
  sortOrder: 'asc' | 'desc'
): Prisma.EventRegistrationOrderByWithRelationInput {
  const map: Record<string, Prisma.EventRegistrationOrderByWithRelationInput> = {
    registeredAt: { registeredAt: sortOrder },
    status: { status: sortOrder },
    createdAt: { createdAt: sortOrder },
  };
  return map[sortBy || ''] || { registeredAt: sortOrder };
}

// ── Repository ────────────────────────────────────────────────────

export const registrationRepository = {
  /**
   * Listado paginado de inscripciones de un evento.
   */
  async findByEvent(
    eventId: string,
    filters: RegistrationQueryInput
  ): Promise<PaginatedResult<RegistrationWithEntity>> {
    const where: Prisma.EventRegistrationWhereInput = { eventId };

    if (filters.status) where.status = filters.status;

    if (filters.search) {
      where.entity = {
        displayName: { contains: filters.search, mode: 'insensitive' },
      };
    }

    const [data, total] = await Promise.all([
      prisma.eventRegistration.findMany({
        where,
        include: REGISTRATION_LIST_INCLUDES,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: buildOrderBy(filters.sortBy, filters.sortOrder),
      }),
      prisma.eventRegistration.count({ where }),
    ]);

    return { data, total, page: filters.page, limit: filters.limit };
  },

  /**
   * Busca inscripciones de una entidad (historial cross-event).
   */
  async findByEntity(entityId: string) {
    return prisma.eventRegistration.findMany({
      where: { entityId },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
            eventType: true,
            status: true,
            startDate: true,
          },
        },
        _count: { select: { answers: true } },
      },
      orderBy: { registeredAt: 'desc' },
    });
  },

  /**
   * Detalle de una inscripción por ID.
   */
  async findById(id: string): Promise<RegistrationDetail | null> {
    return prisma.eventRegistration.findUnique({
      where: { id },
      include: REGISTRATION_DETAIL_INCLUDES,
    });
  },

  /**
   * Verifica si ya existe inscripción (entidad + evento).
   */
  async findExisting(eventId: string, entityId: string): Promise<EventRegistration | null> {
    return prisma.eventRegistration.findUnique({
      where: {
        eventId_entityId: { eventId, entityId },
      },
    });
  },

  /**
   * Crea inscripción + respuestas en transacción.
   */
  async create(data: {
    eventId: string;
    entityId: string;
    status?: string;
    notes?: string;
    sourceOrigin?: string;
    answers?: Array<{ fieldKey: string; fieldLabel: string; value: string }>;
  }): Promise<RegistrationDetail> {
    return prisma.eventRegistration.create({
      data: {
        event: { connect: { id: data.eventId } },
        entity: { connect: { id: data.entityId } },
        status: (data.status as any) || 'REGISTERED',
        notes: data.notes,
        sourceOrigin: data.sourceOrigin,
        answers: data.answers?.length
          ? { create: data.answers }
          : undefined,
      },
      include: REGISTRATION_DETAIL_INCLUDES,
    });
  },

  /**
   * Actualiza inscripción.
   */
  async update(
    id: string,
    data: Prisma.EventRegistrationUpdateInput
  ): Promise<RegistrationDetail> {
    return prisma.eventRegistration.update({
      where: { id },
      data,
      include: REGISTRATION_DETAIL_INCLUDES,
    });
  },

  /**
   * Elimina inscripción y sus respuestas (cascade).
   */
  async remove(id: string): Promise<EventRegistration> {
    return prisma.eventRegistration.delete({
      where: { id },
    });
  },

  /**
   * Verifica que el evento existe.
   */
  async eventExists(eventId: string): Promise<boolean> {
    const count = await prisma.event.count({ where: { id: eventId } });
    return count > 0;
  },

  /**
   * Verifica que la entidad existe y está activa.
   */
  async entityExists(entityId: string): Promise<boolean> {
    const count = await prisma.entity.count({
      where: { id: entityId, status: { not: 'MERGED' } },
    });
    return count > 0;
  },
};
