/**
 * Service del módulo de inscripciones a eventos.
 * Lógica de negocio para inscripción de entidades a eventos.
 */
import { registrationRepository } from './registration.repository';
import { eventRepository } from './event.repository';
import {
  RegistrationQueryInput,
  CreateRegistrationInput,
  UpdateRegistrationInput,
} from './registration.validator';
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
} from '../../shared/errors/app-error';
import { PaginationMeta } from '../../shared/types/api-response.types';

// ── Helpers ───────────────────────────────────────────────────────

function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
}

// ── Service ───────────────────────────────────────────────────────

export const registrationService = {
  /**
   * Listado paginado de inscripciones de un evento.
   */
  async listByEvent(eventId: string, filters: RegistrationQueryInput) {
    // Verificar que el evento exista
    const eventExists = await registrationRepository.eventExists(eventId);
    if (!eventExists) {
      throw new NotFoundError('Evento', eventId);
    }

    const result = await registrationRepository.findByEvent(eventId, filters);
    return {
      data: result.data,
      meta: buildPaginationMeta(result.total, result.page, result.limit),
    };
  },

  /**
   * Historial de inscripciones de una entidad (cross-event).
   */
  async listByEntity(entityId: string) {
    const entityExists = await registrationRepository.entityExists(entityId);
    if (!entityExists) {
      throw new NotFoundError('Entidad', entityId);
    }

    return registrationRepository.findByEntity(entityId);
  },

  /**
   * Detalle de una inscripción.
   */
  async getById(id: string) {
    const registration = await registrationRepository.findById(id);
    if (!registration) {
      throw new NotFoundError('Inscripción', id);
    }
    return registration;
  },

  /**
   * Inscribir una entidad a un evento.
   * Validaciones:
   * - El evento debe existir
   * - La entidad debe existir y no estar MERGED
   * - No puede haber inscripción duplicada (mismo evento + entidad)
   * - Si hay maxCapacity, verificar que no esté lleno
   * - El evento no debe estar CANCELLED
   */
  async create(eventId: string, input: CreateRegistrationInput) {
    // Verificar que el evento existe
    const event = await eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Evento', eventId);
    }

    // Verificar que el evento no esté cancelado
    if (event.status === 'CANCELLED') {
      throw new BadRequestError('No se puede inscribir a un evento cancelado');
    }

    // Verificar que la entidad existe
    const entityExists = await registrationRepository.entityExists(input.entityId);
    if (!entityExists) {
      throw new NotFoundError('Entidad', input.entityId);
    }

    // Verificar que no exista inscripción duplicada
    const existing = await registrationRepository.findExisting(eventId, input.entityId);
    if (existing) {
      throw new ConflictError(
        'La entidad ya está inscrita en este evento',
        { existingRegistrationId: existing.id, eventId, entityId: input.entityId }
      );
    }

    // Verificar capacidad máxima
    if (event.maxCapacity) {
      const currentCount = await eventRepository.countRegistrations(eventId);
      if (currentCount >= event.maxCapacity) {
        throw new BadRequestError(
          `El evento ha alcanzado su capacidad máxima (${event.maxCapacity})`,
          { currentCount, maxCapacity: event.maxCapacity }
        );
      }
    }

    return registrationRepository.create({
      eventId,
      entityId: input.entityId,
      status: input.status,
      notes: input.notes,
      sourceOrigin: input.sourceOrigin,
      answers: input.answers,
    });
  },

  /**
   * Actualizar inscripción (estado, notas, timestamps).
   */
  async update(id: string, input: UpdateRegistrationInput) {
    const current = await registrationRepository.findById(id);
    if (!current) {
      throw new NotFoundError('Inscripción', id);
    }

    const data: Record<string, any> = {};
    if (input.status !== undefined) data.status = input.status;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.confirmedAt !== undefined) data.confirmedAt = new Date(input.confirmedAt);
    if (input.attendedAt !== undefined) data.attendedAt = new Date(input.attendedAt);

    // Auto-set timestamps en cambios de estado
    if (input.status === 'CONFIRMED' && !data.confirmedAt) {
      data.confirmedAt = new Date();
    }
    if (input.status === 'ATTENDED' && !data.attendedAt) {
      data.attendedAt = new Date();
    }

    return registrationRepository.update(id, data);
  },

  /**
   * Eliminar inscripción y sus respuestas.
   */
  async remove(id: string, userId?: string | null) {
    const registration = await registrationRepository.findById(id);
    if (!registration) {
      throw new NotFoundError('Inscripción', id);
    }

    return registrationRepository.remove(id, userId);
  },
};
