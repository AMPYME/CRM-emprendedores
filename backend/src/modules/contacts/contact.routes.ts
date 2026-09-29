/**
 * Rutas del módulo de contactos.
 * 
 * Rutas anidadas bajo entidad:
 *   GET    /api/v1/entities/:entityId/contacts     — lista contactos de la entidad
 *   POST   /api/v1/entities/:entityId/contacts     — crea contacto para la entidad
 * 
 * Rutas directas de contacto:
 *   PUT    /api/v1/contacts/:id                     — actualiza un contacto
 *   DELETE /api/v1/contacts/:id                     — elimina un contacto
 */
import { Router } from 'express';
import { contactController } from './contact.controller';
import { forbidReadOnly, protect } from '../auth/auth.middleware';
import { asyncHandler } from '../../shared/utils/async-handler';
import { validate } from '../../shared/middlewares/validate.middleware';
import {
  createContactSchema,
  updateContactSchema,
  entityIdParamSchema,
  contactIdParamSchema,
} from './contact.validator';

// ── Rutas anidadas bajo entidad (:entityId/contacts) ─────────────
export const entityContactRoutes = Router({ mergeParams: true });

entityContactRoutes.get(
  '/',
  validate(entityIdParamSchema, 'params'),
  asyncHandler(contactController.listByEntity)
);

entityContactRoutes.post(
  '/',
  protect,
  forbidReadOnly,
  validate(entityIdParamSchema, 'params'),
  validate(createContactSchema, 'body'),
  asyncHandler(contactController.create)
);

// ── Rutas directas de contacto (/contacts/:id) ──────────────────
export const contactRoutes = Router();

contactRoutes.put(
  '/:id',
  protect,
  forbidReadOnly,
  validate(contactIdParamSchema, 'params'),
  validate(updateContactSchema, 'body'),
  asyncHandler(contactController.update)
);

contactRoutes.delete(
  '/:id',
  protect,
  forbidReadOnly,
  validate(contactIdParamSchema, 'params'),
  asyncHandler(contactController.remove)
);
