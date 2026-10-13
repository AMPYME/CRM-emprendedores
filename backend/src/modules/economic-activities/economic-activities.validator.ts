/**
 * Validadores Zod — actividades económicas CINU 4.1.
 */
import { z } from 'zod';

export const cinuParentQuerySchema = z.object({
  category_id: z.string().uuid().optional(),
  division_id: z.string().uuid().optional(),
  group_id: z.string().uuid().optional(),
  class_id: z.string().uuid().optional(),
  version_code: z.string().trim().max(32).optional(),
});

export const cinuSearchQuerySchema = z.object({
  q: z.string().trim().min(2, 'La búsqueda requiere al menos 2 caracteres').max(120),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CinuSearchQuery = z.infer<typeof cinuSearchQuerySchema>;

export const assignEconomicActivitySchema = z.object({
  cinuClassId: z.string().uuid('cinuClassId debe ser un UUID válido'),
  cinuSubclassId: z.string().uuid('cinuSubclassId debe ser un UUID válido').nullable().optional(),
  isPrimary: z.boolean().optional().default(false),
  specificActivity: z
    .string()
    .trim()
    .max(25, 'La actividad específica no puede superar 25 caracteres')
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  hasNoticeOfOperation: z.boolean().nullable().optional(),
});

export type AssignEconomicActivityInput = z.infer<typeof assignEconomicActivitySchema>;

export const patchEconomicActivitySchema = z
  .object({
    isPrimary: z.literal(true),
  })
  .strict();

export type PatchEconomicActivityInput = z.infer<typeof patchEconomicActivitySchema>;

export const entityIdParamSchema = z.object({
  entityId: z.string().uuid('entityId debe ser un UUID válido'),
});

export const entityActivityParamsSchema = z.object({
  entityId: z.string().uuid('entityId debe ser un UUID válido'),
  activityId: z.string().uuid('activityId debe ser un UUID válido'),
});

export const categoryIdQuerySchema = z.object({
  category_id: z.string().uuid('category_id es requerido'),
  version_code: z.string().trim().max(32).optional(),
});

export const divisionIdQuerySchema = z.object({
  division_id: z.string().uuid('division_id es requerido'),
});

export const groupIdQuerySchema = z.object({
  group_id: z.string().uuid('group_id es requerido'),
});

export const classIdQuerySchema = z.object({
  class_id: z.string().uuid('class_id es requerido'),
});
