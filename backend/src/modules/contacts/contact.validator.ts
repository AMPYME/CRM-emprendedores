/**
 * Validadores Zod para el módulo de contactos.
 */
import { z } from 'zod';

// ── Crear contacto ────────────────────────────────────────────────
export const createContactSchema = z.object({
  contactType: z.enum(['EMAIL', 'PHONE', 'MOBILE', 'WHATSAPP', 'WEBSITE', 'SOCIAL_MEDIA', 'OTHER']),
  contactValue: z.string().min(1, 'Valor de contacto requerido').max(300).trim(),
  label: z.string().max(50).trim().optional(),
  isPrimary: z.boolean().default(false),
  isVerified: z.boolean().default(false),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;

// ── Actualizar contacto ───────────────────────────────────────────
export const updateContactSchema = createContactSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export type UpdateContactInput = z.infer<typeof updateContactSchema>;

// ── Param de entityId ─────────────────────────────────────────────
export const entityIdParamSchema = z.object({
  entityId: z.string().uuid('Entity ID debe ser un UUID válido'),
});

// ── Param de contact id ───────────────────────────────────────────
export const contactIdParamSchema = z.object({
  id: z.string().uuid('Contact ID debe ser un UUID válido'),
});
