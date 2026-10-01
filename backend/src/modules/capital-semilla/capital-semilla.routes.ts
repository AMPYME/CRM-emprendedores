/**
 * Rutas del módulo Capital Semilla.
 */
import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler';
import { validate } from '../../shared/middlewares/validate.middleware';
import { forbidReadOnly, protect } from '../auth/auth.middleware';
import { capitalSemillaController } from './capital-semilla.controller';
import {
  capitalSemillaFechaSchema,
  capitalSemillaQuerySchema,
  linkCapitalSemillaSchema,
} from './capital-semilla.validator';
import { z } from 'zod';

const idParamSchema = z.object({ id: z.string().uuid() });

export const capitalSemillaRoutes = Router();

capitalSemillaRoutes.get(
  '/',
  protect,
  validate(capitalSemillaQuerySchema, 'query'),
  asyncHandler(capitalSemillaController.list)
);

capitalSemillaRoutes.get(
  '/verificar',
  protect,
  asyncHandler(capitalSemillaController.verificar)
);

capitalSemillaRoutes.patch(
  '/persona/:id/fecha',
  protect,
  forbidReadOnly,
  validate(idParamSchema, 'params'),
  validate(capitalSemillaFechaSchema, 'body'),
  asyncHandler(capitalSemillaController.setFecha)
);

capitalSemillaRoutes.post(
  '/:id/link',
  protect,
  forbidReadOnly,
  validate(idParamSchema, 'params'),
  validate(linkCapitalSemillaSchema, 'body'),
  asyncHandler(capitalSemillaController.link)
);
