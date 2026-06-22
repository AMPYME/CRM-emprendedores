/**
 * Servicio de mapeo de columnas.
 * Aplica mappings de columnas Excel → campos del sistema.
 * Soporta templates predefinidos (DIRECTORIO, EVENTO) y mappings custom.
 * Incluye auto-detección de columnas por patrones comunes.
 */
import {
  ColumnMapping,
  ExtractedFields,
  getTemplate,
  SYSTEM_FIELDS,
} from './import.types';
import {
  normalizeCedula,
  normalizeRuc,
  normalizePhone,
  normalizeEmail,
  titleCase,
} from '../../shared/utils/string.utils';
import { logger } from '../../shared/logger/logger';

// ── Auto-detección de columnas ───────────────────────────────────

function splitFullName(raw: string): { firstName?: string; lastName?: string } {
  const cleaned = raw
    .toString()
    .trim()
    .replace(/\s+/g, ' ');

  if (!cleaned) return {};

  // Formato: "Apellido(s), Nombre(s)"
  if (cleaned.includes(',')) {
    const [left, right] = cleaned
      .split(',', 2)
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      firstName: right || undefined,
      lastName: left || undefined,
    };
  }

  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length < 2) return { firstName: cleaned };

  // Heurística:
  // - 2 tokens: "Juan Pérez" → first=Juan, last=Pérez
  // - 3+ tokens: tomar los últimos 2 como apellidos ("Juan Carlos Pérez López")
  if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1] };
  }

  const lastName = parts.slice(-2).join(' ');
  const firstName = parts.slice(0, -2).join(' ');
  return { firstName: firstName || undefined, lastName: lastName || undefined };
}

/**
 * Patrones comunes para cada campo del sistema.
 * Se usan para auto-detectar el mapeo cuando el usuario no proporciona uno.
 */
const FIELD_PATTERNS: Record<string, RegExp[]> = {
  // Persona
  firstName: [
    /^nombre$/i,
    /^first.?name$/i,
    /^primer.?nombre$/i,
    /^nombres?$/i,
    // Variantes donde el "nombre" suele venir completo (nombre + apellido/s)
    /^nombre.?completo$/i,
    /^full.?name$/i,
    /^nombre.?y.?apellido$/i,
    /^nombres?.?y.?apellidos?$/i,
  ],
  lastName: [/^apellido$/i, /^last.?name$/i, /^primer.?apellido$/i, /^apellidos?$/i],
  secondLastName: [/^segundo.?apellido$/i, /^second.?last.?name$/i, /^apellido.?2$/i],
  cedula: [/^cedula$/i, /^ced$/i, /^ci$/i, /^documento$/i, /^identificacion$/i, /^no.?cedula$/i],
  gender: [/^genero$/i, /^sexo$/i, /^gender$/i],
  birthDate: [/^fecha.?nacimiento$/i, /^nacimiento$/i, /^birth$/i],
  nationality: [/^nacionalidad$/i, /^pais$/i],
  educationLevel: [/^nivel.?educativo$/i, /^educacion$/i, /^escolaridad$/i],
  occupation: [/^ocupacion$/i, /^oficio$/i, /^profesion$/i, /^occupation$/i],

  // Empresa
  ruc: [/^ruc$/i, /^registro.?unico$/i, /^no.?ruc$/i],
  dv: [/^dv$/i, /^digito.?verificador$/i],
  legalName: [/^razon.?social$/i, /^legal.?name$/i, /^nombre.?legal$/i],
  tradeName: [/^nombre.?comercial$/i, /^trade.?name$/i, /^marca$/i],
  companyType: [/^tipo.?empresa$/i, /^tipo.?sociedad$/i],
  employeeCount: [/^empleados$/i, /^num.?empleados$/i, /^cantidad.?empleados$/i],

  // Establecimiento
  establishmentName: [/^nombre.?establecimiento$/i, /^local$/i, /^establecimiento$/i],
  establishmentType: [/^tipo.?establecimiento$/i, /^tipo.?local$/i],
  noticeOfOperation: [/^aviso.?operacion$/i, /^aviso.?op$/i],

  // Comunes
  businessName: [/^nombre.?negocio$/i, /^negocio$/i, /^business$/i, /^empresa$/i, /^nombre.?empresa$/i],
  economicActivity: [/^actividad.?economica$/i, /^actividad$/i, /^rubro$/i, /^giro$/i, /^sector$/i],
  province: [/^provincia$/i, /^prov$/i],
  district: [/^distrito$/i, /^dist$/i],
  corregimiento: [/^corregimiento$/i, /^correg$/i],
  address: [/^direccion$/i, /^dir$/i, /^address$/i, /^domicilio$/i],

  // Contacto
  email: [/^correo$/i, /^email$/i, /^e.?mail$/i, /^correo.?electronico$/i],
  phone: [/^telefono$/i, /^phone$/i, /^tel$/i, /^fono$/i],
  mobile: [/^celular$/i, /^cell$/i, /^movil$/i, /^mobile$/i],
  whatsapp: [/^whatsapp$/i, /^wsp$/i, /^wa$/i],
  website: [/^sitio.?web$/i, /^web$/i, /^website$/i, /^pagina$/i, /^url$/i],
};

/**
 * Intenta detectar automáticamente el mapeo de columnas
 * basado en patrones comunes de nombres de columnas Excel.
 *
 * @param headers - Lista de nombres de columna (normalizados) del Excel
 * @returns Mapeo parcial auto-detectado { systemField: excelColumn }
 */
export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const usedHeaders = new Set<string>();

  for (const [field, patterns] of Object.entries(FIELD_PATTERNS)) {
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;

      const normalizedHeader = header
        .toLowerCase()
        .replace(/[\s_-]+/g, '_')
        .replace(/[^a-z0-9_]/g, '');

      for (const pattern of patterns) {
        if (pattern.test(normalizedHeader) || pattern.test(header)) {
          mapping[field] = header;
          usedHeaders.add(header);
          break;
        }
      }

      if (mapping[field]) break;
    }
  }

  return mapping;
}

/**
 * Construye el mapeo final: combina template + auto-deteccion + custom.
 * Prioridad: custom > template > auto-detect
 *
 * @param sourceType  - "DIRECTORIO", "EVENTO", etc.
 * @param headers     - Columnas del Excel
 * @param customMapping - Mapeo manual del usuario (opcional)
 * @returns Mapeo final validado contra las columnas existentes
 */
export function buildMapping(
  sourceType: string,
  headers: string[],
  customMapping?: ColumnMapping | null
): ColumnMapping {
  // 1. Auto-detectar desde patrones
  const autoMapping = autoDetectMapping(headers);

  // 2. Template predefinido por sourceType
  const template = getTemplate(sourceType);

  // 3. Merge con prioridad: custom > template > auto
  const finalMapping: ColumnMapping = {
    ...autoMapping,
    ...(template || {}),
    ...(customMapping || {}),
  };

  // 4. Filtrar: solo mantener campos que apunten a columnas existentes
  const validMapping: ColumnMapping = {};
  const headersLower = new Set(headers.map((h) => h.toLowerCase()));

  for (const [field, column] of Object.entries(finalMapping)) {
    if (headers.includes(column) || headersLower.has(column.toLowerCase())) {
      validMapping[field] = column;
    }
  }

  logger.debug('Mapeo de columnas construido', {
    sourceType,
    autoDetected: Object.keys(autoMapping).length,
    template: template ? Object.keys(template).length : 0,
    custom: customMapping ? Object.keys(customMapping).length : 0,
    final: Object.keys(validMapping).length,
  });

  return validMapping;
}

/**
 * Aplica el mapeo de columnas a una fila de datos crudos.
 * Extrae los campos del sistema y los normaliza para deduplicacion.
 *
 * @param rawData  - Fila cruda del Excel { excelColumn: value }
 * @param mapping  - Mapeo { systemField: excelColumn }
 * @returns Campos extraidos y normalizados
 */
export function applyMapping(
  rawData: Record<string, unknown>,
  mapping: ColumnMapping
): ExtractedFields {
  const fields: ExtractedFields = {};

  // Helper: obtener valor string de un systemField
  const getValue = (systemField: string): string | undefined => {
    const column = mapping[systemField];
    if (!column) return undefined;
    const val = rawData[column];
    if (val === null || val === undefined) return undefined;
    return String(val).trim() || undefined;
  };

  // Cedula
  const cedula = getValue('cedula');
  if (cedula) fields.extractedCedula = normalizeCedula(cedula);

  // RUC
  const ruc = getValue('ruc');
  if (ruc) fields.extractedRuc = normalizeRuc(ruc);

  // Nombre
  const firstName = getValue('firstName');
  if (firstName) fields.extractedFirstName = titleCase(firstName);

  // Apellido
  const lastName = getValue('lastName');
  if (lastName) fields.extractedLastName = titleCase(lastName);

  // Si el Excel trae "nombre completo" en una sola columna, completar faltantes.
  // Caso típico: mapping.firstName apunta a "nombre_completo" y mapping.lastName no existe.
  if (fields.extractedFirstName && !fields.extractedLastName) {
    const split = splitFullName(fields.extractedFirstName);
    if (split.firstName && split.lastName) {
      fields.extractedFirstName = titleCase(split.firstName);
      fields.extractedLastName = titleCase(split.lastName);
    }
  }

  // Email
  const email = getValue('email');
  if (email) fields.extractedEmail = normalizeEmail(email);

  // Telefono (probar phone, mobile, whatsapp)
  const phone = getValue('phone') || getValue('mobile') || getValue('whatsapp');
  if (phone) fields.extractedPhone = normalizePhone(phone);

  // Nombre de negocio
  const businessName = getValue('businessName') || getValue('establishmentName') || getValue('tradeName');
  if (businessName) fields.extractedBusinessName = titleCase(businessName);

  return fields;
}

/**
 * Devuelve la lista de campos del sistema disponibles para mapear.
 * Util para el frontend al configurar el mapeo.
 */
export function getAvailableSystemFields(): Array<{ key: string; label: string }> {
  return Object.entries(SYSTEM_FIELDS).map(([key, label]) => ({
    key,
    label,
  }));
}

/**
 * Infiere el entityType segun el sourceType y los datos extraidos.
 */
export function inferEntityType(
  sourceType: string,
  extractedFields: ExtractedFields
): 'PERSON' | 'COMPANY' | 'ESTABLISHMENT' {
  if (sourceType === 'DIRECTORIO') return 'ESTABLISHMENT';
  if (sourceType.startsWith('EVENTO')) return 'PERSON';

  // Heuristica basada en campos disponibles
  if (extractedFields.extractedCedula) return 'PERSON';
  if (extractedFields.extractedRuc) return 'COMPANY';
  if (extractedFields.extractedBusinessName && !extractedFields.extractedFirstName) return 'ESTABLISHMENT';

  return 'PERSON'; // Default
}
