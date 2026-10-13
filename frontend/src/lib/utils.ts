/**
 * Utilidades generales del frontend.
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina clases CSS con soporte para Tailwind merge.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extrae YYYY-MM-DD de un Date o ISO (campo de solo fecha, sin hora local).
 * Para strings ISO usa el prefijo de calendario; para Date usa el día local.
 */
export function toDateOnlyString(date: string | Date): string {
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return '';
    date = parsed;
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formatea fecha para mostrar en UI.
 */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-PA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

/**
 * Formatea un campo de solo fecha (evita correr un día por zona horaria).
 */
export function formatDateOnly(date: string | Date): string {
  const ymd = toDateOnlyString(date);
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('es-PA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/**
 * Formatea fecha corta.
 */
export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat('es-PA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date));
}

/**
 * Formatea corta un campo de solo fecha (evita correr un día por zona horaria).
 */
export function formatDateShortOnly(date: string | Date): string {
  const ymd = toDateOnlyString(date);
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('es-PA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}
