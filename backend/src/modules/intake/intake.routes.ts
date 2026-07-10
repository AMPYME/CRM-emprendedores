/**
 * Rutas del módulo intake (todas protegidas con JWT del CRM).
 *
 *   POST /api/v1/intake/sessions              - abrir sesión (devuelve sessionId + código)
 *   GET  /api/v1/intake/sessions              - listar sesiones activas
 *   GET  /api/v1/intake/sessions/:id          - snapshot de una sesión
 *   POST /api/v1/intake/sessions/:id/verify-access - valida el código de acceso
 *   POST /api/v1/intake/sessions/:id/regenerate-access-code - genera un código nuevo
 *   POST /api/v1/intake/sessions/:id/validate - migrar a PostgreSQL + borrar de MySQL
 */
import { Router } from 'express';
import { intakeController } from './intake.controller';
import { asyncHandler } from '../../shared/utils/async-handler';
import { validate } from '../../shared/middlewares/validate.middleware';
import { protect } from '../auth/auth.middleware';
import {
  sessionIdParamSchema,
  listQuerySchema,
  createSessionSchema,
  updateSessionSchema,
  accessCodeQuerySchema,
  accessCodeBodySchema,
  regenerateAccessCodeSchema,
} from './intake.validator';

export const intakeRoutes = Router();

intakeRoutes.post(
  '/sessions',
  protect,
  validate(createSessionSchema, 'body'),
  asyncHandler(intakeController.createSession)
);

intakeRoutes.get(
  '/sessions',
  protect,
  validate(listQuerySchema, 'query'),
  asyncHandler(intakeController.list)
);

intakeRoutes.get(
  '/sessions/:id',
  protect,
  validate(sessionIdParamSchema, 'params'),
  validate(accessCodeQuerySchema, 'query'),
  asyncHandler(intakeController.getById)
);

intakeRoutes.post(
  '/sessions/:id/verify-access',
  protect,
  validate(sessionIdParamSchema, 'params'),
  validate(accessCodeBodySchema, 'body'),
  asyncHandler(intakeController.verifyAccess)
);

intakeRoutes.post(
  '/sessions/:id/regenerate-access-code',
  protect,
  validate(sessionIdParamSchema, 'params'),
  validate(regenerateAccessCodeSchema, 'body'),
  asyncHandler(intakeController.regenerateAccessCode)
);

intakeRoutes.post(
  '/sessions/:id/validate',
  protect,
  validate(sessionIdParamSchema, 'params'),
  validate(accessCodeBodySchema, 'body'),
  asyncHandler(intakeController.validate)
);

intakeRoutes.patch(
  '/sessions/:id',
  protect,
  validate(sessionIdParamSchema, 'params'),
  validate(updateSessionSchema.merge(accessCodeBodySchema), 'body'),
  asyncHandler(intakeController.update)
);

intakeRoutes.delete(
  '/sessions/:id',
  protect,
  validate(sessionIdParamSchema, 'params'),
  asyncHandler(intakeController.remove)
);
