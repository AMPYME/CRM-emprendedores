/**
 * Rutas del módulo de relaciones entre entidades.
 *
 * Rutas anidadas bajo entidad:
 *   GET    /api/v1/entities/:entityId/relationships    — lista relaciones de la entidad
 *   POST   /api/v1/entities/:entityId/relationships    — crea relación desde la entidad
 *
 * Rutas directas de relación:
 *   PUT    /api/v1/relationships/:id                   — actualiza una relación
 *   DELETE /api/v1/relationships/:id                   — marca relación como inactiva (soft delete)
 */
import { Router } from 'express';
import { relationshipController } from './relationship.controller';
import { asyncHandler } from '../../shared/utils/async-handler';
import { validate } from '../../shared/middlewares/validate.middleware';
import {
  createRelationshipSchema,
  updateRelationshipSchema,
  entityIdParamSchema,
  relationshipIdParamSchema,
  relationshipQuerySchema,
} from './relationship.validator';

// ── Rutas anidadas bajo entidad (:entityId/relationships) ──────────
export const entityRelationshipRoutes = Router({ mergeParams: true });

entityRelationshipRoutes.get(
  '/',
  validate(entityIdParamSchema, 'params'),
  validate(relationshipQuerySchema, 'query'),
  asyncHandler(relationshipController.listByEntity)
);

entityRelationshipRoutes.post(
  '/',
  validate(entityIdParamSchema, 'params'),
  validate(createRelationshipSchema, 'body'),
  asyncHandler(relationshipController.create)
);

// ── Rutas directas de relación (/relationships/:id) ────────────────
export const relationshipRoutes = Router();

relationshipRoutes.put(
  '/:id',
  validate(relationshipIdParamSchema, 'params'),
  validate(updateRelationshipSchema, 'body'),
  asyncHandler(relationshipController.update)
);

relationshipRoutes.delete(
  '/:id',
  validate(relationshipIdParamSchema, 'params'),
  asyncHandler(relationshipController.remove)
);

