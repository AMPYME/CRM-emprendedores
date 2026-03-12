/**
 * Validadores Zod para el módulo de entidades (búsqueda cross-type).
 */
import { z } from 'zod';

// ── Query params para listado ─────────────────────────────────────
export const entityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['displayName', 'createdAt', 'updatedAt', 'province']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().min(1).optional(),
  entityType: z.enum(['PERSON', 'COMPANY', 'ESTABLISHMENT']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DUPLICATE', 'MERGED']).optional(),
  province: z.string().optional(),
});

export type EntityQueryInput = z.infer<typeof entityQuerySchema>;

// ── Param de ID ───────────────────────────────────────────────────
export const entityIdParamSchema = z.object({
  id: z.string().uuid('ID debe ser un UUID válido'),
});

export type EntityIdParam = z.infer<typeof entityIdParamSchema>;
