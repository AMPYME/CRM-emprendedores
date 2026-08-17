/**
 * Tipos e interfaces del módulo de importaciones.
 * Define mapeos de columnas, templates predefinidos y resultados de deduplicación.
 */

// ── Mapeo de columnas ────────────────────────────────────────────

/**
 * Mapeo de columna Excel → campo del sistema.
 * Clave = nombre del campo del sistema, Valor = nombre de la columna Excel.
 */
export interface ColumnMapping {
  [systemField: string]: string;
}

/**
 * Campos extraíbles de staging (para deduplicación).
 */
export interface ExtractedFields {
  extractedCedula?: string;
  extractedRuc?: string;
  extractedFirstName?: string;
  extractedLastName?: string;
  extractedEmail?: string;
  extractedPhone?: string;
  extractedBusinessName?: string;
}

/**
 * Campos del sistema que se pueden mapear desde Excel.
 */
export const SYSTEM_FIELDS = {
  // Persona
  firstName: 'Nombre',
  lastName: 'Apellido',
  secondLastName: 'Segundo Apellido',
  cedula: 'Cédula',
  gender: 'Género',
  birthDate: 'Fecha de Nacimiento',
  nationality: 'Nacionalidad',
  educationLevel: 'Nivel Educativo',
  occupation: 'Ocupación',

  // Empresa
  ruc: 'RUC',
  dv: 'Dígito Verificador',
  legalName: 'Razón Social',
  tradeName: 'Nombre Comercial',
  companyType: 'Tipo de Sociedad',
  employeeCount: 'Cantidad de Empleados',

  // Establecimiento
  establishmentName: 'Nombre del Establecimiento',
  establishmentType: 'Tipo de Establecimiento',
  noticeOfOperation: 'Aviso de Operación',

  // Comunes
  businessName: 'Nombre del Negocio',
  economicActivity: 'Actividad Económica',
  province: 'Provincia',
  district: 'Distrito',
  corregimiento: 'Corregimiento',
  address: 'Dirección',

  // Contacto
  email: 'Correo Electrónico',
  phone: 'Teléfono',
  mobile: 'Celular',
  whatsapp: 'WhatsApp',
  website: 'Sitio Web',

  // Evento (solo para importaciones de tipo EVENTO)
  eventNotes: 'Notas del Evento',
} as const;

export type SystemFieldKey = keyof typeof SYSTEM_FIELDS;

// ── Templates de mapeo predefinidos ──────────────────────────────

export type SourceType = 'DIRECTORIO' | 'EVENTO' | 'CUSTOM';

/**
 * Template predefinido para importación de directorio comercial.
 * Mapea establecimientos/negocios.
 */
export const DIRECTORIO_TEMPLATE: ColumnMapping = {
  establishmentName: 'nombre_establecimiento',
  economicActivity: 'actividad_economica',
  province: 'provincia',
  district: 'distrito',
  corregimiento: 'corregimiento',
  address: 'direccion',
  phone: 'telefono',
  email: 'correo',
  tradeName: 'nombre_comercial',
  ruc: 'ruc',
  noticeOfOperation: 'aviso_operacion',
  establishmentType: 'tipo_establecimiento',
};

/**
 * Template predefinido para importación de base de eventos.
 * Mapea personas inscritas a eventos.
 */
export const EVENTO_TEMPLATE: ColumnMapping = {
  firstName: 'nombre',
  lastName: 'apellido',
  secondLastName: 'segundo_apellido',
  cedula: 'cedula',
  email: 'correo',
  phone: 'telefono',
  mobile: 'celular',
  businessName: 'nombre_negocio',
  economicActivity: 'actividad_economica',
  province: 'provincia',
  district: 'distrito',
  gender: 'genero',
  occupation: 'ocupacion',
  educationLevel: 'nivel_educativo',
};

/**
 * Obtiene el template predefinido por sourceType.
 */
export function getTemplate(sourceType: string): ColumnMapping | null {
  switch (sourceType) {
    case 'DIRECTORIO':
      return { ...DIRECTORIO_TEMPLATE };
    case 'EVENTO':
    default:
      // Cualquier tipo EVENTO_* usa el template de evento
      if (sourceType.startsWith('EVENTO')) {
        return { ...EVENTO_TEMPLATE };
      }
      return null;
  }
}

// ── Resultado de deduplicación ───────────────────────────────────

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

// ── Resultado de validación ──────────────────────────────────────

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// ── Resultado de parseo de Excel ─────────────────────────────────

export interface ParsedExcelData {
  headers: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
}

// ── Estadísticas de importación ──────────────────────────────────

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

// ── Datos para creación de entidad desde staging ─────────────────

export interface StagingToEntityData {
  entityType: 'PERSON' | 'COMPANY' | 'ESTABLISHMENT';
  displayName: string;
  province?: string;
  district?: string;
  corregimiento?: string;
  address?: string;
  sourceOrigin: string;
  importBatchId: string;
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
    economicActivity?: string;
  };
  company?: {
    legalName: string;
    ruc?: string;
    dv?: string;
    tradeName?: string;
    companyType?: string;
    economicActivity?: string;
    employeeCount?: number;
  };
  establishment?: {
    establishmentName: string;
    establishmentType?: string;
    economicActivity?: string;
    noticeOfOperation?: string;
  };
  contacts?: Array<{
    contactType: string;
    contactValue: string;
    label?: string;
  }>;
}
