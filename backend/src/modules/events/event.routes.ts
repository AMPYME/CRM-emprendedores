/**
 * Rutas del módulo de eventos e inscripciones.
 *
 * Eventos:
 *   GET    /api/v1/events              — listado paginado
 *   POST   /api/v1/events              — crear evento
 *   GET    /api/v1/events/:id          — detalle
 *   PUT    /api/v1/events/:id          — actualizar
 *   DELETE /api/v1/events/:id          — cancelar (soft delete)
 *
 * Inscripciones anidadas bajo evento:
 *   GET    /api/v1/events/:eventId/registrations      — inscripciones del evento
 *   POST   /api/v1/events/:eventId/registrations      — inscribir entidad
 *
 * Inscripciones anidadas bajo entidad:
 *   GET    /api/v1/entities/:entityId/registrations    — historial de inscripciones
 *
 * Inscripciones directas:
 *   GET    /api/v1/registrations/:id                   — detalle inscripción
 *   PUT    /api/v1/registrations/:id                   — actualizar inscripción
 *   DELETE /api/v1/registrations/:id                   — eliminar inscripción
 */
import { Router } from 'express';
import { eventController } from './event.controller';
import { registrationController } from './registration.controller';
import { asyncHandler } from '../../shared/utils/async-handler';
import { validate } from '../../shared/middlewares/validate.middleware';
import {
  createEventSchema,
  updateEventSchema,
  eventQuerySchema,
  eventIdParamSchema,
  eventIdNestedParamSchema,
} from './event.validator';
import {
  createRegistrationSchema,
  updateRegistrationSchema,
  registrationQuerySchema,
  registrationIdParamSchema,
} from './registration.validator';
import { entityIdParamSchema as entityIdRouteParam } from '../contacts/contact.validator';

// ── Rutas de eventos ──────────────────────────────────────────────
export const eventRoutes = Router();

eventRoutes.get(
  '/',
  validate(eventQuerySchema, 'query'),
  asyncHandler(eventController.list)
);

eventRoutes.post(
  '/',
  validate(createEventSchema, 'body'),
  asyncHandler(eventController.create)
);

eventRoutes.get(
  '/:id',
  validate(eventIdParamSchema, 'params'),
  asyncHandler(eventController.getById)
);

eventRoutes.put(
  '/:id',
  validate(eventIdParamSchema, 'params'),
  validate(updateEventSchema, 'body'),
  asyncHandler(eventController.update)
);

eventRoutes.delete(
  '/:id',
  validate(eventIdParamSchema, 'params'),
  asyncHandler(eventController.cancel)
);

// ── Inscripciones anidadas bajo evento (/events/:eventId/registrations) ──
export const eventRegistrationRoutes = Router({ mergeParams: true });

eventRegistrationRoutes.get(
  '/',
  validate(eventIdNestedParamSchema, 'params'),
  validate(registrationQuerySchema, 'query'),
  asyncHandler(registrationController.listByEvent)
);

eventRegistrationRoutes.post(
  '/',
  validate(eventIdNestedParamSchema, 'params'),
  validate(createRegistrationSchema, 'body'),
  asyncHandler(registrationController.create)
);

// ── Inscripciones anidadas bajo entidad (/entities/:entityId/registrations) ──
export const entityRegistrationRoutes = Router({ mergeParams: true });

entityRegistrationRoutes.get(
  '/',
  validate(entityIdRouteParam, 'params'),
  asyncHandler(registrationController.listByEntity)
);

// ── Rutas directas de inscripción (/registrations/:id) ───────────
export const registrationRoutes = Router();

registrationRoutes.get(
  '/:id',
  validate(registrationIdParamSchema, 'params'),
  asyncHandler(registrationController.getById)
);

registrationRoutes.put(
  '/:id',
  validate(registrationIdParamSchema, 'params'),
  validate(updateRegistrationSchema, 'body'),
  asyncHandler(registrationController.update)
);

registrationRoutes.delete(
  '/:id',
  validate(registrationIdParamSchema, 'params'),
  asyncHandler(registrationController.remove)
);
