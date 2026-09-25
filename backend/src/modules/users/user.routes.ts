import { Router } from 'express';
import { z } from 'zod';
import { userAdminService } from './user.service';
import { protect, requireFullAccess } from '../auth/auth.middleware';
import { asyncHandler } from '../../shared/utils/async-handler';
import { validate } from '../../shared/middlewares/validate.middleware';
import { sendSuccess } from '../../shared/utils/response.utils';

const assignSchema = z.object({
  sedeId: z.string().uuid().nullable(),
  departamentoId: z.string().uuid().nullable(),
});

const idSchema = z.object({
  id: z.string().uuid(),
});

export const userAdminRoutes = Router();

userAdminRoutes.use(protect, requireFullAccess);

userAdminRoutes.get('/', asyncHandler(async (_req, res) => {
  sendSuccess(res, await userAdminService.list());
}));

userAdminRoutes.put(
  '/:id',
  validate(idSchema, 'params'),
  validate(assignSchema, 'body'),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await userAdminService.updateAssignment(req.params.id as string, req.body));
  })
);
