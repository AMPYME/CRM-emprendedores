/**
 * Repository del módulo de eventos.
 * Queries Prisma para CRUD de eventos.
 */
import { Prisma, Event } from '@prisma/client';
import { prisma } from '../../config/database';
import { EventQueryInput } from './event.validator';
import { PaginatedResult } from '../../shared/types/api-response.types';

// ── Includes reutilizables ────────────────────────────────────────

const EVENT_LIST_INCLUDES = {
  _count: {
    select: {
      registrations: true,
    },
  },
} satisfies Prisma.EventInclude;

const EVENT_DETAIL_INCLUDES = {
  _count: {
    select: {
      registrations: true,
    },
  },
  registrations: {
    take: 10,
    orderBy: { registeredAt: 'desc' as const },
    include: {
      entity: {
        select: {
          id: true,
          displayName: true,
          entityType: true,
          status: true,
        },
      },
    },
  },
} satisfies Prisma.EventInclude;

// ── Tipos derivados ───────────────────────────────────────────────

export type EventWithCount = Prisma.EventGetPayload<{
  include: typeof EVENT_LIST_INCLUDES;
}>;

export type EventDetail = Prisma.EventGetPayload<{
  include: typeof EVENT_DETAIL_INCLUDES;
}>;

// ── Helpers ───────────────────────────────────────────────────────

function buildOrderBy(
  sortBy: string | undefined,
  sortOrder: 'asc' | 'desc'
): Prisma.EventOrderByWithRelationInput {
  const map: Record<string, Prisma.EventOrderByWithRelationInput> = {
    name: { name: sortOrder },
    startDate: { startDate: sortOrder },
    createdAt: { createdAt: sortOrder },
    status: { status: sortOrder },
  };
  return map[sortBy || ''] || { createdAt: sortOrder };
}

// ── Repository ────────────────────────────────────────────────────

export const eventRepository = {
  /**
   * Listado paginado de eventos con filtros.
   */
  async findAll(filters: EventQueryInput): Promise<PaginatedResult<EventWithCount>> {
    const where: Prisma.EventWhereInput = {};

    if (filters.status) where.status = filters.status;
    if (filters.eventType) where.eventType = { contains: filters.eventType, mode: 'insensitive' };
    if (filters.province) where.province = { contains: filters.province, mode: 'insensitive' };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { location: { contains: filters.search, mode: 'insensitive' } },
        { eventType: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: EVENT_LIST_INCLUDES,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: buildOrderBy(filters.sortBy, filters.sortOrder),
      }),
      prisma.event.count({ where }),
    ]);

    return { data, total, page: filters.page, limit: filters.limit };
  },

  /**
   * Detalle de un evento por ID.
   */
  async findById(id: string): Promise<EventDetail | null> {
    return prisma.event.findUnique({
      where: { id },
      include: EVENT_DETAIL_INCLUDES,
    });
  },

  /**
   * Busca evento por slug (para unicidad).
   */
  async findBySlug(slug: string): Promise<Event | null> {
    return prisma.event.findUnique({
      where: { slug },
    });
  },

  /**
   * Crea un evento nuevo.
   */
  async create(data: Prisma.EventCreateInput): Promise<EventWithCount> {
    return prisma.event.create({
      data,
      include: EVENT_LIST_INCLUDES,
    });
  },

  /**
   * Actualiza un evento existente.
   */
  async update(id: string, data: Prisma.EventUpdateInput): Promise<EventDetail> {
    return prisma.event.update({
      where: { id },
      data,
      include: EVENT_DETAIL_INCLUDES,
    });
  },

  /**
   * Cancela un evento (soft delete → status CANCELLED).
   */
  async cancel(id: string): Promise<EventWithCount> {
    return prisma.event.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: EVENT_LIST_INCLUDES,
    });
  },

  /**
   * Cuenta inscripciones de un evento.
   */
  async countRegistrations(eventId: string): Promise<number> {
    return prisma.eventRegistration.count({
      where: { eventId },
    });
  },
};
