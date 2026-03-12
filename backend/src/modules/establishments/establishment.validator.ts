/**
 * Validadores Zod para el módulo de establecimientos.
 */
import { z } from 'zod';

// ── Schema de contacto embebido ───────────────────────────────────
const contactSchema = z.object({
  contactType: z.enum(['EMAIL', 'PHONE', 'MOBILE', 'WHATSAPP', 'WEBSITE', 'SOCIAL_MEDIA', 'OTHER']),
  contactValue: z.string().min(1, 'Valor de contacto requerido').max(300).trim(),
  label: z.string().max(50).optional(),
  isPrimary: z.boolean().default(false),
});

// ── Crear establecimiento ─────────────────────────────────────────
export const createEstablishmentSchema = z.object({
  // Campos de entidad
  province: z.string().max(100).trim().optional(),
  district: z.string().max(100).trim().optional(),
  corregimiento: z.string().max(100).trim().optional(),
  address: z.string().max(500).trim().optional(),
  notes: z.string().max(2000).trim().optional(),
  sourceOrigin: z.string().max(100).trim().optional(),

  // Campos de establecimiento
  establishmentName: z.string().min(1, 'Nombre del establecimiento es requerido').max(300).trim(),
  establishmentType: z.string().max(100).trim().optional(),
  economicActivity: z.string().max(200).trim().optional(),
  noticeOfOperation: z.string().max(50).trim().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),

  // Contactos opcionales en creación
  contacts: z.array(contactSchema).optional(),
});

export type CreateEstablishmentInput = z.infer<typeof createEstablishmentSchema>;

// ── Actualizar establecimiento ────────────────────────────────────
export const updateEstablishmentSchema = createEstablishmentSchema
  .omit({ contacts: true, sourceOrigin: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export type UpdateEstablishmentInput = z.infer<typeof updateEstablishmentSchema>;

// ── Filtros de listado ────────────────────────────────────────────
export const establishmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['displayName', 'createdAt', 'establishmentName', 'economicActivity']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().min(1).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DUPLICATE']).optional(),
  province: z.string().optional(),
  establishmentType: z.string().optional(),
  economicActivity: z.string().optional(),
});

export type EstablishmentQueryInput = z.infer<typeof establishmentQuerySchema>;
