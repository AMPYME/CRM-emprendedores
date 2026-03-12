/**
 * Validadores Zod para inscripciones a eventos.
 */
import { z } from 'zod';

// ── Schema de respuesta a campo dinámico ──────────────────────────
const answerSchema = z.object({
  fieldKey: z.string().min(1).max(50),
  fieldLabel: z.string().min(1).max(200),
  value: z.string().max(2000),
});

// ── Crear inscripción ─────────────────────────────────────────────
export const createRegistrationSchema = z.object({
  entityId: z.string().uuid('Entity ID debe ser un UUID válido'),
  status: z.enum(['REGISTERED', 'CONFIRMED', 'ATTENDED', 'NO_SHOW', 'CANCELLED']).default('REGISTERED'),
  notes: z.string().max(2000).trim().optional(),
  sourceOrigin: z.string().max(100).trim().optional(),
  answers: z.array(answerSchema).optional(),
});

export type CreateRegistrationInput = z.infer<typeof createRegistrationSchema>;

// ── Actualizar inscripción ────────────────────────────────────────
export const updateRegistrationSchema = z.object({
  status: z.enum(['REGISTERED', 'CONFIRMED', 'ATTENDED', 'NO_SHOW', 'CANCELLED']).optional(),
  notes: z.string().max(2000).trim().optional(),
  confirmedAt: z.string().optional(),
  attendedAt: z.string().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Debe enviar al menos un campo para actualizar',
});

export type UpdateRegistrationInput = z.infer<typeof updateRegistrationSchema>;

// ── Filtros de listado de inscripciones ───────────────────────────
export const registrationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['registeredAt', 'status', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().min(1).optional(),
  status: z.enum(['REGISTERED', 'CONFIRMED', 'ATTENDED', 'NO_SHOW', 'CANCELLED']).optional(),
});

export type RegistrationQueryInput = z.infer<typeof registrationQuerySchema>;

// ── Param de registration ID ──────────────────────────────────────
export const registrationIdParamSchema = z.object({
  id: z.string().uuid('Registration ID debe ser un UUID válido'),
});

export type RegistrationIdParam = z.infer<typeof registrationIdParamSchema>;
