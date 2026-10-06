/**
 * Validación de tipo/número de documento panameño (cédula / pasaporte).
 */

export type DocumentTypeValue = 'CEDULA_NUMERO' | 'CEDULA_LETRA' | 'PASAPORTE';

const CEDULA_NUMERO_RE = /^\d+-\d+-\d+$/;
const CEDULA_SOLO_DIGITOS_RE = /^\d{5,15}$/;
const CEDULA_LETRA_RE = /^(E|PE|N)-\d+-\d+$/i;
const PASAPORTE_RE = /^[A-Z0-9]{1,20}$/;

export function normalizeDocumentNumber(
  documentType: DocumentTypeValue | undefined | null,
  documentNumber: string | undefined | null
): string | undefined {
  if (!documentNumber?.trim()) return undefined;
  const raw = documentNumber.trim();
  if (documentType === 'PASAPORTE') return raw.toUpperCase();
  if (documentType === 'CEDULA_LETRA') {
    const parts = raw.split('-');
    if (parts.length >= 1) parts[0] = parts[0]!.toUpperCase();
    return parts.join('-');
  }
  return raw;
}

export function validateDocumentNumber(
  documentType: DocumentTypeValue | undefined | null,
  documentNumber: string | undefined | null,
  options?: { required?: boolean }
): string | null {
  const required = options?.required === true;
  if (!documentType && !documentNumber?.trim()) {
    return required ? 'Seleccione el tipo de documento' : null;
  }
  if (!documentType) return 'Seleccione el tipo de documento';
  if (!documentNumber?.trim()) return 'Ingrese el número de documento';

  const value = normalizeDocumentNumber(documentType, documentNumber)!;

  if (documentType === 'CEDULA_NUMERO') {
    if (!CEDULA_NUMERO_RE.test(value) && !CEDULA_SOLO_DIGITOS_RE.test(value)) {
      return 'Formato inválido. Use solo números y dos guiones (ej. 8-554-6674) o solo dígitos';
    }
    return null;
  }

  if (documentType === 'CEDULA_LETRA') {
    if (!CEDULA_LETRA_RE.test(value)) {
      return 'Formato inválido. Prefijo E, PE o N (ej. E-8-866-5775)';
    }
    return null;
  }

  if (documentType === 'PASAPORTE') {
    if (value.includes('-') || !PASAPORTE_RE.test(value)) {
      return 'Pasaporte: solo A-Z y 0-9, máximo 20 caracteres, sin guiones';
    }
    return null;
  }

  return 'Tipo de documento inválido';
}

/** Infieren el tipo a partir del número (p. ej. sesiones intake que solo guardan cédula). */
export function inferDocumentType(
  documentNumber: string | undefined | null
): DocumentTypeValue | undefined {
  if (!documentNumber?.trim()) return undefined;
  const raw = documentNumber.trim();
  if (CEDULA_NUMERO_RE.test(raw) || CEDULA_SOLO_DIGITOS_RE.test(raw)) return 'CEDULA_NUMERO';
  if (CEDULA_LETRA_RE.test(raw)) return 'CEDULA_LETRA';
  const upper = raw.toUpperCase();
  if (/[A-Z]/.test(upper) && !upper.includes('-') && PASAPORTE_RE.test(upper)) return 'PASAPORTE';
  return undefined;
}
