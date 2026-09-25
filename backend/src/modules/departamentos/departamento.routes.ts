import { Router } from 'express';
import { z } from 'zod';
import { departamentoService } from './departamento.service';
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

export const departamentoRoutes = Router();

departamentoRoutes.use(protect);

departamentoRoutes.get('/', asyncHandler(async (_req, res) => {
  sendSuccess(res, await departamentoService.list());
}));

departamentoRoutes.post('/', requireFullAccess, validate(nameSchema, 'body'), asyncHandler(async (req, res) => {
  sendCreated(res, await departamentoService.create(req.body.name));
}));

departamentoRoutes.put('/:id', requireFullAccess, validate(idSchema, 'params'), validate(nameSchema, 'body'), asyncHandler(async (req, res) => {
  sendSuccess(res, await departamentoService.update(req.params.id as string, req.body.name));
}));

departamentoRoutes.delete('/:id', requireFullAccess, validate(idSchema, 'params'), asyncHandler(async (req, res) => {
  await departamentoService.remove(req.params.id as string);
  sendSuccess(res, { deleted: true });
}));
