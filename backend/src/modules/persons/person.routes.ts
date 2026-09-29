/**
 * Rutas del módulo de personas.
 */
import { Router } from 'express';
import { personController } from './person.controller';
import { forbidReadOnly, protect } from '../auth/auth.middleware';
import { asyncHandler } from '../../shared/utils/async-handler';
import { validate } from '../../shared/middlewares/validate.middleware';
import {
  createPersonSchema,
  updatePersonSchema,
  personQuerySchema,
} from './person.validator';
import { entityIdParamSchema } from '../entities/entity.validator';
import { saveCapitalSemillaSchema } from '../capital-semilla/capital-semilla.validator';

export const personRoutes = Router();

personRoutes.get(
  '/',
  validate(personQuerySchema, 'query'),
  asyncHandler(personController.list)
);

personRoutes.get(
  '/lookup',
  asyncHandler(personController.lookupByCedula)
);

personRoutes.get(
  '/:id/capital-semilla',
  validate(entityIdParamSchema, 'params'),
  asyncHandler(personController.listCapitalSemilla)
);

personRoutes.put(
  '/:id/capital-semilla',
  protect,
  forbidReadOnly,
  validate(entityIdParamSchema, 'params'),
  validate(saveCapitalSemillaSchema, 'body'),
  asyncHandler(personController.saveCapitalSemilla)
);

personRoutes.get(
  '/:id',
  validate(entityIdParamSchema, 'params'),
  asyncHandler(personController.getById)
);

personRoutes.post(
  '/',
  protect,
  forbidReadOnly,
  validate(createPersonSchema, 'body'),
  asyncHandler(personController.create)
);

personRoutes.put(
  '/:id',
  protect,
  forbidReadOnly,
  validate(entityIdParamSchema, 'params'),
  validate(updatePersonSchema, 'body'),
  asyncHandler(personController.update)
);

personRoutes.delete(
  '/:id',
  protect,
  forbidReadOnly,
  validate(entityIdParamSchema, 'params'),
  asyncHandler(personController.remove)
);
