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
 * Público (sin JWT; código de acceso):
 *   GET  /api/v1/intake/public/field-sessions
 *   POST /api/v1/intake/public/field-sessions/unlock
 *   GET  /api/v1/intake/public/sessions/:id
 *   POST /api/v1/intake/public/sessions/:id/verify-access
 *   PATCH /api/v1/intake/public/sessions/:id
 *   POST /api/v1/intake/public/sessions/:id/submit
 */
import { Router } from 'express';
import { intakeController } from './intake.controller';
import { asyncHandler } from '../../shared/utils/async-handler';
import { validate } from '../../shared/middlewares/validate.middleware';
import { protect, forbidViewer } from '../auth/auth.middleware';
import {
  sessionIdParamSchema,
  listQuerySchema,
  createSessionSchema,
  updateSessionSchema,
  accessCodeQuerySchema,
  optionalAccessCodeQuerySchema,
  accessCodeBodySchema,
  optionalAccessCodeBodySchema,
  regenerateAccessCodeSchema,
} from './intake.validator';

export const intakeRoutes = Router();

const updateWithAccess = updateSessionSchema.merge(accessCodeBodySchema);
const updateOperator = updateSessionSchema.merge(optionalAccessCodeBodySchema);

// ── Público (sin JWT) ───────────────────────────────────────────
intakeRoutes.get(
  '/public/field-sessions',
  asyncHandler(intakeController.listPublicFieldSessions)
);

intakeRoutes.post(
  '/public/field-sessions/unlock',
  validate(accessCodeBodySchema, 'body'),
  asyncHandler(intakeController.unlockPublicFieldSession)
);

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
  forbidViewer,
  validate(createSessionSchema, 'body'),
  asyncHandler(intakeController.createSession)
);

intakeRoutes.get(
  '/sessions',
  protect,
  forbidViewer,
  validate(listQuerySchema, 'query'),
  asyncHandler(intakeController.list)
);

intakeRoutes.get(
  '/sessions/:id',
  protect,
  forbidViewer,
  validate(sessionIdParamSchema, 'params'),
  validate(optionalAccessCodeQuerySchema, 'query'),
  asyncHandler(intakeController.getById)
);

intakeRoutes.post(
  '/sessions/:id/verify-access',
  protect,
  forbidViewer,
  validate(sessionIdParamSchema, 'params'),
  validate(accessCodeBodySchema, 'body'),
  asyncHandler(intakeController.verifyAccess)
);

intakeRoutes.post(
  '/sessions/:id/regenerate-access-code',
  protect,
  forbidViewer,
  validate(sessionIdParamSchema, 'params'),
  validate(regenerateAccessCodeSchema, 'body'),
  asyncHandler(intakeController.regenerateAccessCode)
);

intakeRoutes.post(
  '/sessions/:id/validate',
  protect,
  forbidViewer,
  validate(sessionIdParamSchema, 'params'),
  validate(optionalAccessCodeBodySchema, 'body'),
  asyncHandler(intakeController.validate)
);

intakeRoutes.patch(
  '/sessions/:id',
  protect,
  forbidViewer,
  validate(sessionIdParamSchema, 'params'),
  validate(updateOperator, 'body'),
  asyncHandler(intakeController.update)
);

intakeRoutes.delete(
  '/sessions/:id',
  protect,
  forbidViewer,
  validate(sessionIdParamSchema, 'params'),
  asyncHandler(intakeController.remove)
);
