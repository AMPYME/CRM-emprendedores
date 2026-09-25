import { Router } from 'express';
import { z } from 'zod';
import { sedeService } from './sede.service';
import { protect, requireFullAccess } from '../auth/auth.middleware';
import { asyncHandler } from '../../shared/utils/async-handler';
import { validate } from '../../shared/middlewares/validate.middleware';
import { sendCreated, sendSuccess } from '../../shared/utils/response.utils';

const nameSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(120),
});

const idSchema = z.object({
  id: z.string().uuid(),
});

export const sedeRoutes = Router();

sedeRoutes.use(protect);

sedeRoutes.get('/', asyncHandler(async (_req, res) => {
  sendSuccess(res, await sedeService.list());
}));

sedeRoutes.post('/', requireFullAccess, validate(nameSchema, 'body'), asyncHandler(async (req, res) => {
  sendCreated(res, await sedeService.create(req.body.name));
}));

sedeRoutes.put('/:id', requireFullAccess, validate(idSchema, 'params'), validate(nameSchema, 'body'), asyncHandler(async (req, res) => {
  sendSuccess(res, await sedeService.update(req.params.id as string, req.body.name));
}));

sedeRoutes.delete('/:id', requireFullAccess, validate(idSchema, 'params'), asyncHandler(async (req, res) => {
  await sedeService.remove(req.params.id as string);
  sendSuccess(res, { deleted: true });
}));
