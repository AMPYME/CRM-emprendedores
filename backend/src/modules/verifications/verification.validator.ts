import { z } from 'zod';

/** Query params llegan como "" cuando el frontend no filtra; tratarlos como ausentes. */
const emptyToUndefined = (val: unknown) =>
  val === '' || val === null || val === undefined ? undefined : val;

export const verificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  search: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  entityType: z.preprocess(emptyToUndefined, z.enum(['PERSON', 'COMPANY']).optional()),
  source: z.preprocess(emptyToUndefined, z.enum(['IMPORT', 'FIELD']).optional()),
  status: z.preprocess(
    emptyToUndefined,
    z.enum(['PENDING', 'ASSIGNED', 'IN_REVIEW', 'VALIDATED', 'REJECTED']).optional()
  ),
  assignment: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 'all' : val),
    z.enum(['all', 'unassigned', 'mine', 'others']).default('all')
  ),
  provinceId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  districtId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  corregimientoId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  importId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});

export const rejectVerificationSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export type VerificationQueryInput = z.infer<typeof verificationQuerySchema>;
export type RejectVerificationInput = z.infer<typeof rejectVerificationSchema>;
