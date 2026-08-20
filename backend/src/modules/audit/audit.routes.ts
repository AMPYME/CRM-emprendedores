import { Router } from 'express';
import { auditController } from './audit.controller';
import { protect, authorize } from '../auth/auth.middleware';
import { validate } from '../../shared/middlewares/validate.middleware';
import { auditQuerySchema } from './audit.validator';
import { asyncHandler } from '../../shared/utils/async-handler';

export const auditRoutes = Router();

auditRoutes.get(
  '/',
  protect,
  authorize('ADMIN', 'SUPER_ADMIN', 'EMPREND_ADMIN'),
  validate(auditQuerySchema, 'query'),
  asyncHandler(auditController.list)
);
