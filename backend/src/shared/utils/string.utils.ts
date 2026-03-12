/**
 * Utilidades de normalización y limpieza de strings.
 * Claves para importación y deduplicación.
 */

/**
 * Normaliza texto: trim, lowercase, elimina acentos y caracteres especiales.
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/\s+/g, ' '); // Colapsar espacios múltiples
}

/**
 * Normaliza cédula: solo dígitos.
 */
export function normalizeCedula(cedula: string | null | undefined): string {
  if (!cedula) return '';
  return cedula.replace(/[^0-9]/g, '').trim();
}

/**
 * Normaliza RUC: solo dígitos y guiones (formato panameño).
 */
export function normalizeRuc(ruc: string | null | undefined): string {
  if (!ruc) return '';
  return ruc.replace(/[^0-9\-]/g, '').trim();
}

/**
 * Normaliza teléfono: solo dígitos, sin prefijo de país.
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  let clean = phone.replace(/[^0-9+]/g, '');
  // Eliminar prefijo +507 de Panamá si existe
  if (clean.startsWith('+507')) clean = clean.substring(4);
  if (clean.startsWith('507') && clean.length > 8) clean = clean.substring(3);
  return clean.trim();
}

/**
 * Normaliza email: trim, lowercase.
 */
export function normalizeEmail(email: string | null | undefined): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

/**
 * Capitaliza primera letra de cada palabra.
 */
export function titleCase(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
}
