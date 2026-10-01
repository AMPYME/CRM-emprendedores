import { z } from 'zod';

const optionalText = z.string().trim().max(200).optional().nullable();

export const saveCapitalSemillaSchema = z.object({
  recordId: z.string().uuid().optional(),
  province: optionalText,
  businessName: optionalText,
  actaNumber: z.string().trim().max(80).optional().nullable(),
  amount: z.union([z.number(), z.string(), z.null()]).optional(),
});

export type SaveCapitalSemillaInput = z.infer<typeof saveCapitalSemillaSchema>;

export const capitalSemillaQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().min(1).optional(),
  linked: z.enum(['all', 'yes', 'no']).default('all'),
});

export type CapitalSemillaQueryInput = z.infer<typeof capitalSemillaQuerySchema>;

export const linkCapitalSemillaSchema = z.object({
  personId: z.string().uuid('personId inválido'),
  linkedAt: z.string().min(1, 'La fecha de vínculo es obligatoria'),
});

export type LinkCapitalSemillaInput = z.infer<typeof linkCapitalSemillaSchema>;

/** Fecha de capital semilla por persona (igual flujo que registro empresarial). */
export const capitalSemillaFechaSchema = z.object({
  linkedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use formato AAAA-MM-DD')
    .nullable(),
});

export type CapitalSemillaFechaInput = z.infer<typeof capitalSemillaFechaSchema>;
