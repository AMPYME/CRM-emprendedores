/**
 * Rutas del módulo de actividades económicas (CINU 4.1).
 */
import { Router } from 'express';
import { economicActivitiesController } from './economic-activities.controller';
import { forbidReadOnly, protect } from '../auth/auth.middleware';
import { asyncHandler } from '../../shared/utils/async-handler';
import { validate } from '../../shared/middlewares/validate.middleware';
import {
  assignEconomicActivitySchema,
  categoryIdQuerySchema,
  cinuSearchQuerySchema,
  classIdQuerySchema,
  divisionIdQuerySchema,
  entityActivityParamsSchema,
  entityIdParamSchema,
  groupIdQuerySchema,
  patchEconomicActivitySchema,
} from './economic-activities.validator';

/** Catálogo: /api/v1/economic-activities/... */
export const economicActivitiesRoutes = Router();

economicActivitiesRoutes.get(
  '/categories',
  asyncHandler(economicActivitiesController.listCategories)
);

economicActivitiesRoutes.get(
  '/divisions',
  validate(categoryIdQuerySchema, 'query'),
  asyncHandler(economicActivitiesController.listDivisions)
);

economicActivitiesRoutes.get(
  '/groups',
  validate(divisionIdQuerySchema, 'query'),
  asyncHandler(economicActivitiesController.listGroups)
);

economicActivitiesRoutes.get(
  '/classes',
  validate(groupIdQuerySchema, 'query'),
  asyncHandler(economicActivitiesController.listClasses)
);

economicActivitiesRoutes.get(
  '/subclasses',
  validate(classIdQuerySchema, 'query'),
  asyncHandler(economicActivitiesController.listSubclasses)
);

economicActivitiesRoutes.get(
  '/search',
  validate(cinuSearchQuerySchema, 'query'),
  asyncHandler(economicActivitiesController.search)
);

/** Actividades por entidad: /api/v1/entities/:entityId/economic-activities */
export const entityEconomicActivitiesRoutes = Router({ mergeParams: true });

entityEconomicActivitiesRoutes.get(
  '/',
  validate(entityIdParamSchema, 'params'),
  asyncHandler(economicActivitiesController.listByEntity)
);

entityEconomicActivitiesRoutes.post(
  '/',
  protect,
  forbidReadOnly,
  validate(entityIdParamSchema, 'params'),
  validate(assignEconomicActivitySchema, 'body'),
  asyncHandler(economicActivitiesController.assign)
);

entityEconomicActivitiesRoutes.patch(
  '/:activityId',
  protect,
  forbidReadOnly,
  validate(entityActivityParamsSchema, 'params'),
  validate(patchEconomicActivitySchema, 'body'),
  asyncHandler(economicActivitiesController.patch)
);

entityEconomicActivitiesRoutes.delete(
  '/:activityId',
  protect,
  forbidReadOnly,
  validate(entityActivityParamsSchema, 'params'),
  asyncHandler(economicActivitiesController.remove)
);
