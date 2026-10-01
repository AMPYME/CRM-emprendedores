/**
 * Esquemas de validación del módulo intake.
 */
import { z } from 'zod';

export const sessionIdParamSchema = z.object({
  id: z.string().min(1, 'id requerido'),
});

export const createSessionSchema = z.object({
  entityType: z.enum(['PERSON', 'COMPANY']).default('PERSON'),
});

const accessCodeSchema = z.string().trim().length(6, 'Código de acceso inválido');
const optionalAccessCode = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  accessCodeSchema.optional()
);

export const listQuerySchema = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED', 'VALIDATED', 'EXPIRED']).optional(),
  createdBy: z.string().trim().optional(),
});

export const accessCodeQuerySchema = z.object({
  accessCode: accessCodeSchema,
});

export const optionalAccessCodeQuerySchema = z.object({
  accessCode: optionalAccessCode,
});

export const optionalAccessCodeBodySchema = z.object({
  accessCode: optionalAccessCode,
});

export const accessCodeBodySchema = z.object({
  accessCode: accessCodeSchema,
});

export const regenerateAccessCodeSchema = z.object({});

export const updateSessionSchema = z.object({
  person: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      secondLastName: z.string().optional(),
      cedula: z.string().optional(),
      documentType: z.enum(['CEDULA_NUMERO', 'CEDULA_LETRA', 'PASAPORTE']).optional(),
      documentNumber: z.string().optional(),
      gender: z.string().optional(),
      birthDate: z.string().optional(),
      nationalityCode: z
        .string()
        .trim()
        .toUpperCase()
        .refine((v) => v === '' || v.length === 3, 'Código de nacionalidad inválido')
        .optional(),
      educationLevel: z.string().optional(),
      hasArtisanCard: z.union([z.boolean(), z.string()]).optional(),
    })
    .optional(),
  company: z
    .object({
      legalName: z.string().optional(),
      tradeName: z.string().optional(),
      ruc: z.string().optional(),
      dv: z.string().optional(),
      companyType: z.string().optional(),
      companySizeClass: z.enum(['MICRO', 'PEQUENA', 'MEDIANA']).optional(),
      foundedDate: z.string().optional(),
    })
    .optional(),
  location: z
    .object({
      province: z.string().optional(),
      district: z.string().optional(),
      corregimiento: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  contacts: z
    .array(
      z.object({
        contactType: z.string(),
        contactValue: z.string(),
        label: z.string().optional(),
        isPrimary: z.boolean().optional(),
      })
    )
    .optional(),
  notes: z.string().optional(),
});
