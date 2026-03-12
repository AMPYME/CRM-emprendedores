/**
 * Rutas del módulo de entidades (búsqueda cross-type).
 */
import { Router } from 'express';
import { entityController } from './entity.controller';
import { asyncHandler } from '../../shared/utils/async-handler';
import { validate } from '../../shared/middlewares/validate.middleware';
import { entityQuerySchema, entityIdParamSchema } from './entity.validator';

export const entityRoutes = Router();

entityRoutes.get(
  '/',
  validate(entityQuerySchema, 'query'),
  asyncHandler(entityController.list)
);

entityRoutes.get(
  '/:id',
  validate(entityIdParamSchema, 'params'),
  asyncHandler(entityController.getById)
);
