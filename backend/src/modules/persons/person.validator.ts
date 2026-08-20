/**
 * Validadores Zod para el módulo de personas.
 */
import { z } from 'zod';
import { isNationalityCode } from '../../shared/utils/nationality';

const nationalityCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => isNationalityCode(v), { message: 'Código de nacionalidad ISO Alpha-3 inválido' });

// ── Schema de contacto embebido ───────────────────────────────────
const contactSchema = z.object({
  contactType: z.enum(['EMAIL', 'PHONE', 'MOBILE', 'WHATSAPP', 'WEBSITE', 'SOCIAL_MEDIA', 'OTHER']),
  contactValue: z.string().min(1, 'Valor de contacto requerido').max(300).trim(),
  label: z.string().max(50).optional(),
  isPrimary: z.boolean().default(false),
});

// ── Crear persona ─────────────────────────────────────────────────
export const createPersonSchema = z.object({
  // Campos de entidad
  province: z.string().max(100).trim().optional(),
  district: z.string().max(100).trim().optional(),
  corregimiento: z.string().max(100).trim().optional(),
  address: z.string().max(500).trim().optional(),
  notes: z.string().max(2000).trim().optional(),
  sourceOrigin: z.string().max(100).trim().optional(),

  // Campos de persona
  firstName: z.string().min(1, 'Nombre es requerido').max(100).trim(),
  lastName: z.string().min(1, 'Apellido es requerido').max(100).trim(),
  secondLastName: z.string().max(100).trim().optional(),
  cedula: z.string().max(20).trim().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  birthDate: z.string().optional(),
  nationalityCode: nationalityCodeSchema.optional(),
  educationLevel: z.string().max(100).trim().optional(),
  occupation: z.string().max(100).trim().optional(),
  businessName: z.string().max(200).trim().optional(),
  economicActivity: z.string().max(200).trim().optional(),
  hasArtisanCard: z.boolean().optional(),

  // Contactos opcionales en creación
  contacts: z.array(contactSchema).optional(),
});

export type CreatePersonInput = z.infer<typeof createPersonSchema>;

// ── Actualizar persona ────────────────────────────────────────────
export const updatePersonSchema = createPersonSchema
  .omit({ contacts: true, sourceOrigin: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

// ── Filtros de listado ────────────────────────────────────────────
export const personQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['displayName', 'createdAt', 'firstName', 'lastName', 'cedula']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().min(1).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DUPLICATE']).optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  corregimiento: z.string().optional(),
  cedula: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  economicActivity: z.string().optional(),
  hasArtisanCard: z.coerce.boolean().optional(),
});

export type PersonQueryInput = z.infer<typeof personQuerySchema>;
