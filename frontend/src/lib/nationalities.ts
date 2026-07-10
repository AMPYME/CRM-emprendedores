import paises from '@/data/paises.json';

export type PaisEntry = {
  codigo3: string;
  pais: string;
  nacionalidad: string;
};

export const DEFAULT_NATIONALITY_CODE = 'PAN';

export const NATIONALITIES = paises as PaisEntry[];

export const nationalitySelectOptions = NATIONALITIES.map((p) => ({
  value: p.codigo3,
  label: p.nacionalidad,
}));

export function nationalityLabel(code: string | null | undefined): string {
  if (!code) return '';
  const upper = code.toUpperCase();
  return NATIONALITIES.find((p) => p.codigo3 === upper)?.nacionalidad ?? code;
}
