/**
 * Validadores Zod para el módulo de eventos.
 */
import { z } from 'zod';

// ── Schema de campo dinámico de formulario ────────────────────────
const formFieldSchema = z.object({
  key: z.string().min(1).max(50),
  label: z.string().min(1).max(200),
  type: z.enum(['text', 'number', 'select', 'checkbox', 'date', 'email', 'phone', 'textarea']),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(), // Para campos tipo select
  placeholder: z.string().max(200).optional(),
});

// ── Crear evento ──────────────────────────────────────────────────
export const createEventSchema = z.object({
  name: z.string().min(1, 'Nombre del evento es requerido').max(200).trim(),
  slug: z.string().min(1).max(200).trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug debe contener solo letras minúsculas, números y guiones')
    .optional(), // Se genera automáticamente si no se proporciona
  description: z.string().max(5000).trim().optional(),
  eventType: z.string().max(100).trim().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('DRAFT'),
  startDate: z.string().optional(), // ISO date string
  endDate: z.string().optional(),
  location: z.string().max(500).trim().optional(),
  province: z.string().max(100).trim().optional(),
  maxCapacity: z.coerce.number().int().min(1).optional(),
  formFields: z.array(formFieldSchema).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;

// ── Actualizar evento ─────────────────────────────────────────────
export const updateEventSchema = createEventSchema
  .omit({ slug: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export type UpdateEventInput = z.infer<typeof updateEventSchema>;

// ── Filtros de listado de eventos ─────────────────────────────────
export const eventQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'startDate', 'createdAt', 'status']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().min(1).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  eventType: z.string().optional(),
  province: z.string().optional(),
});

export type EventQueryInput = z.infer<typeof eventQuerySchema>;

// ── Param de event ID ─────────────────────────────────────────────
export const eventIdParamSchema = z.object({
  id: z.string().uuid('Event ID debe ser un UUID válido'),
});

export type EventIdParam = z.infer<typeof eventIdParamSchema>;

// ── Param para rutas anidadas (/events/:eventId/registrations) ────
export const eventIdNestedParamSchema = z.object({
  eventId: z.string().uuid('Event ID debe ser un UUID válido'),
});

export type EventIdNestedParam = z.infer<typeof eventIdNestedParamSchema>;
