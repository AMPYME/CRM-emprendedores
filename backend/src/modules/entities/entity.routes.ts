/**
 * Rutas del módulo de entidades (búsqueda cross-type).
 */
import { Router } from 'express';
import { entityController } from './entity.controller';
import { forbidReadOnly, protect } from '../auth/auth.middleware';
import { asyncHandler } from '../../shared/utils/async-handler';
import { validate } from '../../shared/middlewares/validate.middleware';
import {
  entityQuerySchema,
  entityIdParamSchema,
  registroEmpresarialSchema,
  documentoQuerySchema,
  historialQuerySchema,
} from './entity.validator';

export const entityRoutes = Router();

entityRoutes.get(
  '/',
  validate(entityQuerySchema, 'query'),
  asyncHandler(entityController.list)
);

entityRoutes.get(
  '/verificar',
  protect,
  validate(documentoQuerySchema, 'query'),
  asyncHandler(entityController.verificar)
);

entityRoutes.get(
  '/:id/historial',
  protect,
  validate(entityIdParamSchema, 'params'),
  validate(historialQuerySchema, 'query'),
  asyncHandler(entityController.historial)
);

entityRoutes.patch(
  '/:id/registro-empresarial',
  protect,
  forbidReadOnly,
  validate(entityIdParamSchema, 'params'),
  validate(registroEmpresarialSchema),
  asyncHandler(entityController.setRegistroEmpresarial)
);

entityRoutes.get(
  '/:id',
  validate(entityIdParamSchema, 'params'),
  asyncHandler(entityController.getById)
);
