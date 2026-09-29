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
  entityType: z.enum(['PERSON', 'COMPANY']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DUPLICATE', 'MERGED']).optional(),
  province: z.string().optional(),
});

export type EntityQueryInput = z.infer<typeof entityQuerySchema>;

// ── Param de ID ───────────────────────────────────────────────────
export const entityIdParamSchema = z.object({
  id: z.string().uuid('ID debe ser un UUID válido'),
});

export type EntityIdParam = z.infer<typeof entityIdParamSchema>;

export const documentoQuerySchema = z.object({
  documento: z.string().trim().min(1, 'Indique una cédula o un RUC').max(30),
});

export const historialQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(30).default(30),
});

export const registroEmpresarialSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD').nullable(),
});

export type RegistroEmpresarialInput = z.infer<typeof registroEmpresarialSchema>;
