import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler';
import { validate } from '../../shared/middlewares/validate.middleware';
import { forbidReadOnly, protect } from '../auth/auth.middleware';
import { personChangeController } from './person-change.controller';
import {
  changeRequestIdParamSchema,
  listMyChangeRequestsSchema,
  pendingByEntityQuerySchema,
} from './person-change.validator';

export const personChangeRoutes = Router();

personChangeRoutes.use(protect);

personChangeRoutes.get(
  '/',
  validate(listMyChangeRequestsSchema, 'query'),
  asyncHandler(personChangeController.listMine)
);

personChangeRoutes.get(
  '/pending',
  validate(pendingByEntityQuerySchema, 'query'),
  asyncHandler(personChangeController.hasPending)
);

personChangeRoutes.post(
  '/:id/confirm',
  forbidReadOnly,
  validate(changeRequestIdParamSchema, 'params'),
  asyncHandler(personChangeController.confirm)
);

personChangeRoutes.post(
  '/:id/cancel',
  forbidReadOnly,
  validate(changeRequestIdParamSchema, 'params'),
  asyncHandler(personChangeController.cancel)
);
