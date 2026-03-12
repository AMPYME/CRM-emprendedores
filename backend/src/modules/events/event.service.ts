/**
 * Service del módulo de eventos.
 * Lógica de negocio para CRUD de eventos.
 */
import { Prisma } from '@prisma/client';
import { eventRepository } from './event.repository';
import { EventQueryInput, CreateEventInput, UpdateEventInput } from './event.validator';
import { NotFoundError, ConflictError, BadRequestError } from '../../shared/errors/app-error';
import { PaginationMeta } from '../../shared/types/api-response.types';

// ── Helpers ───────────────────────────────────────────────────────

function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
}

/**
 * Genera un slug a partir del nombre del evento.
 * Ej: "Cumbre PYME 2025" → "cumbre-pyme-2025"
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-z0-9\s-]/g, '')   // Solo alfanuméricos, espacios, guiones
    .replace(/\s+/g, '-')            // Espacios → guiones
    .replace(/-+/g, '-')             // Colapsar guiones
    .replace(/^-|-$/g, '');           // Eliminar guiones al inicio/final
}

/**
 * Genera slug único. Si ya existe, agrega un sufijo numérico.
 */
async function generateUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (await eventRepository.findBySlug(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

// ── Service ───────────────────────────────────────────────────────

export const eventService = {
  /**
   * Listado paginado de eventos con filtros.
   */
  async list(filters: EventQueryInput) {
    const result = await eventRepository.findAll(filters);
    return {
      data: result.data,
      meta: buildPaginationMeta(result.total, result.page, result.limit),
    };
  },

  /**
   * Detalle completo de un evento.
   */
  async getById(id: string) {
    const event = await eventRepository.findById(id);
    if (!event) {
      throw new NotFoundError('Evento', id);
    }
    return event;
  },

  /**
   * Crear evento nuevo.
   * Genera slug automáticamente si no se proporciona.
   */
  async create(input: CreateEventInput) {
    // Generar o validar slug
    let slug: string;
    if (input.slug) {
      const existing = await eventRepository.findBySlug(input.slug);
      if (existing) {
        throw new ConflictError(
          `Ya existe un evento con slug '${input.slug}'`,
          { existingEventId: existing.id, existingName: existing.name }
        );
      }
      slug = input.slug;
    } else {
      slug = await generateUniqueSlug(generateSlug(input.name));
    }

    // Validar fechas
    if (input.startDate && input.endDate) {
      if (new Date(input.endDate) < new Date(input.startDate)) {
        throw new BadRequestError('La fecha de fin no puede ser anterior a la fecha de inicio');
      }
    }

    const data: Prisma.EventCreateInput = {
      name: input.name,
      slug,
      description: input.description,
      eventType: input.eventType,
      status: input.status || 'DRAFT',
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      location: input.location,
      province: input.province,
      maxCapacity: input.maxCapacity,
      formFields: input.formFields ? (input.formFields as any) : undefined,
    };

    return eventRepository.create(data);
  },

  /**
   * Actualizar evento existente.
   */
  async update(id: string, input: UpdateEventInput) {
    const current = await eventRepository.findById(id);
    if (!current) {
      throw new NotFoundError('Evento', id);
    }

    // Validar fechas
    if (input.startDate || input.endDate) {
      const startDate = input.startDate ? new Date(input.startDate) : current.startDate;
      const endDate = input.endDate ? new Date(input.endDate) : current.endDate;
      if (startDate && endDate && endDate < startDate) {
        throw new BadRequestError('La fecha de fin no puede ser anterior a la fecha de inicio');
      }
    }

    const data: Prisma.EventUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.eventType !== undefined) data.eventType = input.eventType;
    if (input.status !== undefined) data.status = input.status;
    if (input.startDate !== undefined) data.startDate = new Date(input.startDate);
    if (input.endDate !== undefined) data.endDate = new Date(input.endDate);
    if (input.location !== undefined) data.location = input.location;
    if (input.province !== undefined) data.province = input.province;
    if (input.maxCapacity !== undefined) data.maxCapacity = input.maxCapacity;
    if (input.formFields !== undefined) data.formFields = input.formFields as any;

    return eventRepository.update(id, data);
  },

  /**
   * Cancelar un evento (soft delete → CANCELLED).
   */
  async cancel(id: string) {
    const event = await eventRepository.findById(id);
    if (!event) {
      throw new NotFoundError('Evento', id);
    }

    if (event.status === 'CANCELLED') {
      throw new BadRequestError('El evento ya está cancelado');
    }

    return eventRepository.cancel(id);
  },
};
