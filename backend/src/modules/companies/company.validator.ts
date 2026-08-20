/**
 * Validadores Zod para el módulo de empresas.
 */
import { z } from 'zod';

// ── Schema de contacto embebido ───────────────────────────────────
const contactSchema = z.object({
  contactType: z.enum(['EMAIL', 'PHONE', 'MOBILE', 'WHATSAPP', 'WEBSITE', 'SOCIAL_MEDIA', 'OTHER']),
  contactValue: z.string().min(1, 'Valor de contacto requerido').max(300).trim(),
  label: z.string().max(50).optional(),
  isPrimary: z.boolean().default(false),
});

// ── Crear empresa ─────────────────────────────────────────────────
export const createCompanySchema = z.object({
  // Campos de entidad
  province: z.string().max(100).trim().optional(),
  district: z.string().max(100).trim().optional(),
  corregimiento: z.string().max(100).trim().optional(),
  address: z.string().max(500).trim().optional(),
  notes: z.string().max(2000).trim().optional(),
  sourceOrigin: z.string().max(100).trim().optional(),

  // Campos de empresa
  legalName: z.string().min(1, 'Razón social es requerida').max(300).trim(),
  tradeName: z.string().max(300).trim().optional(),
  ruc: z.string().max(30).trim().optional(),
  dv: z.string().max(5).trim().optional(),
  companyType: z.string().max(50).trim().optional(),
  companySizeClass: z.enum(['MICRO', 'PEQUENA', 'MEDIANA']).optional(),
  foundedDate: z.string().optional(),

  // Contactos opcionales en creación
  contacts: z.array(contactSchema).optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

// ── Actualizar empresa ────────────────────────────────────────────
export const updateCompanySchema = createCompanySchema
  .omit({ contacts: true, sourceOrigin: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

// ── Filtros de listado ────────────────────────────────────────────
export const companyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['displayName', 'createdAt', 'legalName', 'tradeName', 'ruc']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().min(1).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DUPLICATE']).optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  corregimiento: z.string().optional(),
  ruc: z.string().optional(),
  companyType: z.string().optional(),
  companySizeClass: z.enum(['MICRO', 'PEQUENA', 'MEDIANA']).optional(),
});

export type CompanyQueryInput = z.infer<typeof companyQuerySchema>;
