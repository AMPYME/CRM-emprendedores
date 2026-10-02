/**
 * Validadores Zod para el módulo de personas.
 */
import { z } from 'zod';
import { isNationalityCode } from '../../shared/utils/nationality';
import {
  DocumentTypeValue,
  normalizeDocumentNumber,
  validateDocumentNumber,
} from '../../shared/utils/document.utils';

const nationalityCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => isNationalityCode(v), { message: 'Código de nacionalidad ISO Alpha-3 inválido' });

const contactSchema = z.object({
  contactType: z.enum(['EMAIL', 'PHONE', 'MOBILE', 'WHATSAPP', 'WEBSITE', 'SOCIAL_MEDIA', 'OTHER']),
  contactValue: z.string().min(1, 'Valor de contacto requerido').max(300).trim(),
  label: z.string().max(50).optional(),
  isPrimary: z.boolean().default(false),
});

const documentTypeSchema = z.enum(['CEDULA_NUMERO', 'CEDULA_LETRA', 'PASAPORTE']);

function refineDocument(
  data: { documentType?: DocumentTypeValue; documentNumber?: string; cedula?: string },
  ctx: z.RefinementCtx,
  options?: { required?: boolean }
) {
  const documentType = data.documentType;
  const documentNumber = data.documentNumber ?? data.cedula;
  const err = validateDocumentNumber(documentType, documentNumber, options);
  if (err) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: err.includes('tipo') ? ['documentType'] : ['documentNumber'],
      message: err,
    });
  }
}

const personBodySchema = z.object({
  province: z.string().max(100).trim().optional(),
  district: z.string().max(100).trim().optional(),
  corregimiento: z.string().max(100).trim().optional(),
  address: z.string().max(500).trim().optional(),
  notes: z.string().max(2000).trim().optional(),
  sourceOrigin: z.string().max(100).trim().optional(),

  firstName: z.string().min(1, 'Nombre es requerido').max(100).trim(),
  lastName: z.string().min(1, 'Apellido es requerido').max(100).trim(),
  secondLastName: z.string().max(100).trim().optional(),
  documentType: documentTypeSchema,
  documentNumber: z.string().min(1, 'Número de documento es requerido').max(40).trim(),
  /** Compat: algunos clientes aún envían cedula */
  cedula: z.string().max(40).trim().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  birthDate: z.string().optional(),
  nationalityCode: nationalityCodeSchema.optional(),
  educationLevel: z.string().max(100).trim().optional(),
  occupation: z.string().max(100).trim().optional(),
  businessName: z.string().max(200).trim().optional(),
  economicActivity: z.string().max(128).trim().optional(),
  hasArtisanCard: z.boolean().optional(),

  contacts: z.array(contactSchema).optional(),
});

export const createPersonSchema = personBodySchema.superRefine((data, ctx) =>
  refineDocument(data, ctx, { required: true })
);

export type CreatePersonInput = z.infer<typeof createPersonSchema>;

export const updatePersonSchema = personBodySchema
  .omit({ contacts: true, sourceOrigin: true })
  .partial()
  .superRefine((data, ctx) => {
    const touchingDoc =
      data.documentType !== undefined ||
      data.documentNumber !== undefined ||
      data.cedula !== undefined;
    if (touchingDoc) {
      refineDocument(data, ctx, { required: true });
    }
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

export function resolveDocumentFields(input: {
  documentType?: DocumentTypeValue;
  documentNumber?: string;
  cedula?: string;
}): { documentType?: DocumentTypeValue; documentNumber?: string; cedula?: string } {
  const documentType = input.documentType;
  const documentNumber = normalizeDocumentNumber(
    documentType,
    input.documentNumber ?? input.cedula
  );
  return {
    documentType,
    documentNumber,
    cedula: documentNumber,
  };
}

export const personQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(30).default(30),
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
  seedCapital: z.enum(['0', '1']).optional().transform((value) => (
    value === undefined ? undefined : Number(value) as 0 | 1
  )),
});

export type PersonQueryInput = z.infer<typeof personQuerySchema>;
