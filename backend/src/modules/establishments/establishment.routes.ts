/**
 * Rutas del módulo de establecimientos.
 */
import { Router } from 'express';
import { establishmentController } from './establishment.controller';
import { asyncHandler } from '../../shared/utils/async-handler';
import { validate } from '../../shared/middlewares/validate.middleware';
import {
  createEstablishmentSchema,
  updateEstablishmentSchema,
  establishmentQuerySchema,
} from './establishment.validator';
import { entityIdParamSchema } from '../entities/entity.validator';

export const establishmentRoutes = Router();

establishmentRoutes.get(
  '/',
  validate(establishmentQuerySchema, 'query'),
  asyncHandler(establishmentController.list)
);

establishmentRoutes.get(
  '/:id',
  validate(entityIdParamSchema, 'params'),
  asyncHandler(establishmentController.getById)
);

establishmentRoutes.post(
  '/',
  validate(createEstablishmentSchema, 'body'),
  asyncHandler(establishmentController.create)
);

establishmentRoutes.put(
  '/:id',
  validate(entityIdParamSchema, 'params'),
  validate(updateEstablishmentSchema, 'body'),
  asyncHandler(establishmentController.update)
);

establishmentRoutes.delete(
  '/:id',
  validate(entityIdParamSchema, 'params'),
  asyncHandler(establishmentController.remove)
);
