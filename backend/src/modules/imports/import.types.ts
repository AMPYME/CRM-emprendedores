/**
 * Tipos e interfaces del módulo de importaciones.
 */
import type { ImportStatus } from '@prisma/client';

export interface ColumnMapping {
  [systemField: string]: string;
}

export interface ExtractedFields {
  extractedCedula?: string;
  extractedRuc?: string;
  extractedFirstName?: string;
  extractedLastName?: string;
  extractedEmail?: string;
  extractedPhone?: string;
  extractedBusinessName?: string;
}

export const SYSTEM_FIELDS = {
  firstName: 'Nombre',
  lastName: 'Apellido',
  secondLastName: 'Segundo Apellido',
  cedula: 'Cédula',
  gender: 'Género',
  birthDate: 'Fecha de Nacimiento',
  nationality: 'Nacionalidad',
  educationLevel: 'Nivel Educativo',
  occupation: 'Ocupación',
  ruc: 'RUC',
  dv: 'Dígito Verificador',
  legalName: 'Razón Social',
  tradeName: 'Nombre Comercial',
  companyType: 'Tipo de Sociedad',
  businessName: 'Nombre del Negocio',
  province: 'Provincia',
  district: 'Distrito',
  corregimiento: 'Corregimiento',
  address: 'Dirección',
  email: 'Correo Electrónico',
  phone: 'Teléfono',
  phone2: 'Teléfono 2',
  phone3: 'Teléfono 3',
  mobile: 'Celular',
  whatsapp: 'WhatsApp',
  website: 'Sitio Web',
  eventNotes: 'Notas del Evento',
} as const;

export type SystemFieldKey = keyof typeof SYSTEM_FIELDS;

export interface ImportBatchProgress {
  batchId: string;
  status: ImportStatus;
  phase: 'staging' | 'validation' | 'deduplication' | 'import' | 'verification' | 'done';
  processedInBatch: number;
  remaining: number;
  totalRows: number;
  done: boolean;
}

export interface ImportExecuteBatchProgress {
  batchId: string;
  status: ImportStatus;
  processedInBatch: number;
  remaining: number;
  importedTotal: number;
  errorTotal: number;
  done: boolean;
}

export type SourceType = 'EVENTO' | 'UNIFICADA' | 'CUSTOM';

/** Headers normalizados (como los produce parser.service). */
export const UNIFICADA_TEMPLATE: ColumnMapping = {
  firstName: 'nombre',
  lastName: 'apellido',
  cedula: 'cedula',
  ruc: 'ruc',
  legalName: 'empresa',
  email: 'correo',
  phone: 'telefono',
  phone2: 'telefono_2',
  phone3: 'telefono_3',
  province: 'provincia',
  district: 'distrito',
  corregimiento: 'corregimiento',
  address: 'direccion',
};

export const EVENTO_TEMPLATE: ColumnMapping = {
  firstName: 'nombre',
  lastName: 'apellido',
  secondLastName: 'segundo_apellido',
  cedula: 'cedula',
  email: 'correo',
  phone: 'telefono',
  mobile: 'celular',
  businessName: 'nombre_negocio',
  province: 'provincia',
  district: 'distrito',
  gender: 'genero',
  occupation: 'ocupacion',
  educationLevel: 'nivel_educativo',
};

export function getTemplate(sourceType: string): ColumnMapping | null {
  switch (sourceType) {
    case 'UNIFICADA':
      return { ...UNIFICADA_TEMPLATE };
    case 'EVENTO':
    default:
      if (sourceType.startsWith('EVENTO')) {
        return { ...EVENTO_TEMPLATE };
      }
      return null;
  }
}

export interface DeduplicationMatch {
  entityId: string;
  displayName: string;
  entityType: string;
  score: number;
  reason: string;
}

export interface DeduplicationResult {
  rowId: string;
  matches: DeduplicationMatch[];
  bestMatch: DeduplicationMatch | null;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ParsedExcelData {
  headers: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
}

export interface ImportStats {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateExact: number;
  duplicatePossible: number;
  importedRows: number;
  skippedRows: number;
  pendingReview: number;
}

export interface StagingToEntityData {
  entityType: 'PERSON' | 'COMPANY';
  displayName: string;
  province?: string;
  district?: string;
  corregimiento?: string;
  address?: string;
  sourceOrigin: string;
  importBatchId: string;
  createdById?: string;
  person?: {
    firstName: string;
    lastName: string;
    secondLastName?: string;
    cedula?: string;
    gender?: string;
    birthDate?: string;
    nationalityCode?: string;
    educationLevel?: string;
    occupation?: string;
    businessName?: string;
  };
  company?: {
    legalName: string;
    ruc?: string;
    dv?: string;
    tradeName?: string;
    companyType?: string;
  };
  contacts?: Array<{
    contactType: string;
    contactValue: string;
    label?: string;
  }>;
}
