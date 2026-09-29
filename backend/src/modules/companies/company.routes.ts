/**
 * Rutas del módulo de empresas.
 */
import { Router } from 'express';
import { companyController } from './company.controller';
import { forbidReadOnly, protect } from '../auth/auth.middleware';
import { asyncHandler } from '../../shared/utils/async-handler';
import { validate } from '../../shared/middlewares/validate.middleware';
import {
  createCompanySchema,
  updateCompanySchema,
  companyQuerySchema,
} from './company.validator';
import { entityIdParamSchema } from '../entities/entity.validator';

export const companyRoutes = Router();

companyRoutes.get(
  '/',
  validate(companyQuerySchema, 'query'),
  asyncHandler(companyController.list)
);

companyRoutes.get(
  '/:id',
  validate(entityIdParamSchema, 'params'),
  asyncHandler(companyController.getById)
);

companyRoutes.post(
  '/',
  protect,
  forbidReadOnly,
  validate(createCompanySchema, 'body'),
  asyncHandler(companyController.create)
);

companyRoutes.put(
  '/:id',
  protect,
  forbidReadOnly,
  validate(entityIdParamSchema, 'params'),
  validate(updateCompanySchema, 'body'),
  asyncHandler(companyController.update)
);

companyRoutes.delete(
  '/:id',
  protect,
  forbidReadOnly,
  validate(entityIdParamSchema, 'params'),
  asyncHandler(companyController.remove)
);
