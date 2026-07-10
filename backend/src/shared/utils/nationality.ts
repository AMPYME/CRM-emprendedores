/**
 * Catálogo de nacionalidades (ISO 3166-1 alpha-3) y resolución desde texto de importación.
 */
import paises from '../data/paises.json';

export type PaisEntry = {
  codigo3: string;
  pais: string;
  nacionalidad: string;
};

export const DEFAULT_NATIONALITY_CODE = 'PAN';

const CATALOG = paises as PaisEntry[];

const BY_CODE = new Map(CATALOG.map((p) => [p.codigo3.toUpperCase(), p]));
const BY_NACIONALIDAD = new Map(
  CATALOG.map((p) => [normalizeKey(p.nacionalidad), p.codigo3.toUpperCase()])
);
const BY_PAIS = new Map(CATALOG.map((p) => [normalizeKey(p.pais), p.codigo3.toUpperCase()]));

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function isNationalityCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value.toUpperCase());
}

/** Acepta código ISO-3 o etiquetas de nacionalidad/país del catálogo. */
export function resolveNationalityCode(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return DEFAULT_NATIONALITY_CODE;
  const upper = trimmed.toUpperCase();
  if (isNationalityCode(upper) && BY_CODE.has(upper)) return upper;
  const byNac = BY_NACIONALIDAD.get(normalizeKey(trimmed));
  if (byNac) return byNac;
  const byPais = BY_PAIS.get(normalizeKey(trimmed));
  if (byPais) return byPais;
  return DEFAULT_NATIONALITY_CODE;
}

export function nationalityLabel(code: string | null | undefined): string {
  if (!code) return '';
  return BY_CODE.get(code.toUpperCase())?.nacionalidad ?? code;
}
