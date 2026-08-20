/**
 * Validadores Zod del módulo de importaciones.
 * Schemas para upload, queries, procesamiento y resolución de filas.
 */
import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────

const ImportStatusEnum = z.enum([
  'PENDING',
  'PROCESSING',
  'VALIDATING',
  'DEDUPLICATING',
  'REVIEW_REQUIRED',
  'IMPORTING',
  'VERIFICATION_QUEUED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

const StagingRowStatusEnum = z.enum([
  'PENDING',
  'VALID',
  'INVALID',
  'DUPLICATE_EXACT',
  'DUPLICATE_POSSIBLE',
  'QUEUED_FOR_VERIFICATION',
  'IMPORTED',
  'SKIPPED',
  'ERROR',
]);

// ── Params ───────────────────────────────────────────────────────

export const importIdParamSchema = z.object({
  id: z.string().uuid('ID de importación inválido'),
});

export const rowIdParamSchema = z.object({
  id: z.string().uuid('ID de importación inválido'),
  rowId: z.string().uuid('ID de fila inválido'),
});

// ── Upload ───────────────────────────────────────────────────────

export const uploadSchema = z.object({
  sourceType: z
    .string()
    .min(1, 'El tipo de fuente es requerido')
    .max(100, 'Máximo 100 caracteres'),
  targetEventId: z
    .string()
    .uuid('ID de evento inválido')
    .optional()
    .nullable(),
});

export type UploadInput = z.infer<typeof uploadSchema>;

// ── Query de batches ─────────────────────────────────────────────

export const importQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(['createdAt', 'status', 'totalRows', 'fileName'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  status: ImportStatusEnum.optional(),
  sourceType: z.string().optional(),
  search: z.string().trim().optional(),
});

export type ImportQueryInput = z.infer<typeof importQuerySchema>;

// ── Query de staging rows ────────────────────────────────────────

export const stagingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z
    .enum(['rowNumber', 'status', 'matchScore', 'createdAt'])
    .optional()
    .default('rowNumber'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  status: StagingRowStatusEnum.optional(),
  search: z.string().trim().optional(),
  hasErrors: z.coerce.boolean().optional(),
});

export type StagingQueryInput = z.infer<typeof stagingQuerySchema>;

// ── Actualización de mapeo de columnas ───────────────────────────

export const updateMappingSchema = z.object({
  columnMapping: z.record(z.string(), z.string()).refine(
    (val) => Object.keys(val).length > 0,
    'El mapeo de columnas no puede estar vacío'
  ),
});

export type UpdateMappingInput = z.infer<typeof updateMappingSchema>;

// ── Resolución de fila staging ───────────────────────────────────

export const resolveRowSchema = z.object({
  action: z.enum(['approve', 'skip', 'link'], {
    errorMap: () => ({ message: 'Acción inválida. Use: approve, skip, link' }),
  }),
  linkedEntityId: z
    .string()
    .uuid('ID de entidad inválido')
    .optional()
    .nullable(),
}).refine(
  (data) => {
    // Si la acción es 'link', debe proporcionar linkedEntityId
    if (data.action === 'link' && !data.linkedEntityId) {
      return false;
    }
    return true;
  },
  { message: 'Debe proporcionar linkedEntityId cuando la acción es "link"', path: ['linkedEntityId'] }
);

export type ResolveRowInput = z.infer<typeof resolveRowSchema>;

// ── Preview ──────────────────────────────────────────────────────

export const previewQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type PreviewQueryInput = z.infer<typeof previewQuerySchema>;
