/**
 * Rutas del módulo intake.
 *
 * Operador (JWT):
 *   POST /api/v1/intake/sessions
 *   GET  /api/v1/intake/sessions
 *   GET  /api/v1/intake/sessions/:id
 *   POST /api/v1/intake/sessions/:id/verify-access
 *   POST /api/v1/intake/sessions/:id/regenerate-access-code
 *   POST /api/v1/intake/sessions/:id/validate
 *   PATCH /api/v1/intake/sessions/:id
 *   DELETE /api/v1/intake/sessions/:id
 *
 * Público (sin JWT; sid + accessCode):
 *   GET  /api/v1/intake/public/sessions/:id
 *   POST /api/v1/intake/public/sessions/:id/verify-access
 *   PATCH /api/v1/intake/public/sessions/:id
 *   POST /api/v1/intake/public/sessions/:id/submit
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

const updateWithAccess = updateSessionSchema.merge(accessCodeBodySchema);

// ── Público (sin JWT) ───────────────────────────────────────────
intakeRoutes.get(
  '/public/sessions/:id',
  validate(sessionIdParamSchema, 'params'),
  validate(accessCodeQuerySchema, 'query'),
  asyncHandler(intakeController.getPublic)
);

intakeRoutes.post(
  '/public/sessions/:id/verify-access',
  validate(sessionIdParamSchema, 'params'),
  validate(accessCodeBodySchema, 'body'),
  asyncHandler(intakeController.verifyAccess)
);

intakeRoutes.patch(
  '/public/sessions/:id',
  validate(sessionIdParamSchema, 'params'),
  validate(updateWithAccess, 'body'),
  asyncHandler(intakeController.update)
);

intakeRoutes.post(
  '/public/sessions/:id/submit',
  validate(sessionIdParamSchema, 'params'),
  validate(accessCodeBodySchema, 'body'),
  asyncHandler(intakeController.submit)
);

// ── Operador (JWT) ──────────────────────────────────────────────
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
  validate(updateWithAccess, 'body'),
  asyncHandler(intakeController.update)
);

intakeRoutes.delete(
  '/sessions/:id',
  protect,
  validate(sessionIdParamSchema, 'params'),
  asyncHandler(intakeController.remove)
);
