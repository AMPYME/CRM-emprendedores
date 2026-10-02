/**
 * Validadores de solicitudes de cambio de persona.
 */
import { z } from 'zod';
import { createPersonSchema, updatePersonSchema } from '../persons/person.validator';

export const enqueueCreateSchema = createPersonSchema;
export const enqueueUpdateSchema = updatePersonSchema;

export const changeRequestIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const listMyChangeRequestsSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'ALL']).default('PENDING'),
  /** Solo solicitudes abiertas/creadas por el usuario autenticado */
  mineOnly: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((v) => v === true || v === 'true' || v === '1'),
  documento: z.string().trim().min(1).max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const pendingByEntityQuerySchema = z.object({
  entityId: z.string().uuid(),
});

export type ListMyChangeRequestsInput = z.infer<typeof listMyChangeRequestsSchema>;
