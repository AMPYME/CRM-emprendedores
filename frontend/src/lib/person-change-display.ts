/**
 * Presentación legible de cambios de persona (confirmaciones).
 */
import { companySizeClassLabel } from '@/lib/company-size-class';
import { companyTypeLabel } from '@/lib/company-types';
import { nationalityLabel } from '@/lib/nationalities';
import {
  corregimientoNombre,
  distritoNombre,
  provinciaNombre,
} from '@/lib/division-politica';

export const PERSON_FIELD_LABELS: Record<string, string> = {
  firstName: 'Nombre',
  lastName: 'Primer apellido',
  secondLastName: 'Segundo apellido',
  documentType: 'Tipo de documento',
  documentNumber: 'Número de documento',
  cedula: 'Número de documento',
  gender: 'Género',
  birthDate: 'Fecha de nacimiento',
  nationalityCode: 'Nacionalidad',
  hasArtisanCard: 'Carnet de artesano',
  hasNoticeOfOperation: 'Aviso de operación',
  educationLevel: 'Escolaridad',
  occupation: 'Ocupación',
  businessName: 'Nombre del negocio',
  economicActivity: 'Actividad económica',
  province: 'Provincia',
  district: 'Distrito',
  corregimiento: 'Corregimiento',
  address: 'Dirección',
  notes: 'Notas',
  email: 'Correo electrónico',
  phone: 'Teléfono / Celular',
  registroEmpresarialFecha: 'Fecha de registro empresarial',
  linkedAt: 'Fecha de capital semilla',
  legalName: 'Razón social',
  tradeName: 'Nombre comercial',
  ruc: 'RUC',
  dv: 'DV',
  companyType: 'Tipo de empresa',
  companySizeClass: 'Tamaño',
  foundedDate: 'Fecha de fundación',
};

export type ChangeDiffView = {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Acepta payload nuevo { before, after } o el formato antiguo (solo datos nuevos). */
export function parseChangeDiff(payload: unknown, action?: string): ChangeDiffView {
  if (!isPlainObject(payload)) {
    return { before: {}, after: {} };
  }

  if ('before' in payload || 'after' in payload) {
    return {
      before: isPlainObject(payload.before) ? payload.before : {},
      after: isPlainObject(payload.after) ? payload.after : {},
    };
  }

  // Compat: solicitudes antiguas sin before/after
  if (action === 'DELETE') {
    return { before: {}, after: {} };
  }
  const { apply: _apply, entityId: _entityId, ...rest } = payload;
  return { before: {}, after: rest };
}

export function formatPersonFieldValue(
  key: string,
  value: unknown,
  contexto?: Record<string, unknown>
): string {
  if (value == null || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (value === 'MALE') return 'Masculino';
  if (value === 'FEMALE') return 'Femenino';
  if (value === 'OTHER') return 'Otro';
  if (value === 'CEDULA_NUMERO') return 'Cédula Número';
  if (value === 'CEDULA_LETRA') return 'Cédula Letra';
  if (value === 'PASAPORTE') return 'Pasaporte';
  if (key === 'province') return provinciaNombre(String(value)) || String(value);
  if (key === 'district') {
    const provincia = contexto?.province ? String(contexto.province) : null;
    return distritoNombre(provincia, String(value)) || String(value);
  }
  if (key === 'corregimiento') {
    const provincia = contexto?.province ? String(contexto.province) : null;
    const distrito = contexto?.district ? String(contexto.district) : null;
    return corregimientoNombre(provincia, distrito, String(value)) || String(value);
  }
  if (key === 'nationalityCode') return nationalityLabel(String(value));
  if (key === 'companyType') return companyTypeLabel(String(value));
  if (key === 'companySizeClass') return companySizeClassLabel(String(value));
  return String(value);
}

export function changeDiffRows(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Array<{ key: string; label: string; beforeText: string; afterText: string }> {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).filter(
    (k) => k !== 'apply' && k !== 'entityId' && k !== 'contacts' && k !== 'cedula'
  );

  return keys.map((key) => ({
    key,
    label: PERSON_FIELD_LABELS[key] || key,
    beforeText: formatPersonFieldValue(key, before[key], before),
    afterText: formatPersonFieldValue(key, after[key], after),
  }));
}
