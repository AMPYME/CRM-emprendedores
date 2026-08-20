/**
 * Rutas del módulo de personas.
 */
import { Router } from 'express';
import { personController } from './person.controller';
import { forbidReadOnly } from '../auth/auth.middleware';
import { asyncHandler } from '../../shared/utils/async-handler';
import { validate } from '../../shared/middlewares/validate.middleware';
import {
  createPersonSchema,
  updatePersonSchema,
  personQuerySchema,
} from './person.validator';
import { entityIdParamSchema } from '../entities/entity.validator';

export const personRoutes = Router();

personRoutes.get(
  '/',
  validate(personQuerySchema, 'query'),
  asyncHandler(personController.list)
);

personRoutes.get(
  '/:id',
  validate(entityIdParamSchema, 'params'),
  asyncHandler(personController.getById)
);

personRoutes.post(
  '/',
  forbidReadOnly,
  validate(createPersonSchema, 'body'),
  asyncHandler(personController.create)
);

personRoutes.put(
  '/:id',
  forbidReadOnly,
  validate(entityIdParamSchema, 'params'),
  validate(updatePersonSchema, 'body'),
  asyncHandler(personController.update)
);

personRoutes.delete(
  '/:id',
  forbidReadOnly,
  validate(entityIdParamSchema, 'params'),
  asyncHandler(personController.remove)
);
