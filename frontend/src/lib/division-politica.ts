/**
 * División política de Panamá (cascada provincia → distrito → corregimiento).
 * option.value = código (codProv / codDist / codCorr); label = nombre.
 * Acepta código (nuevo) o nombre (legacy) al resolver.
 */

import divisionData from '@/data/division_politica_panama.json';

export type DivisionTree = Record<
  string,
  {
    nombre: string;
    distritos: Record<
      string,
      {
        nombre: string;
        corregimientos: Record<string, string>;
      }
    >;
  }
>;

const tree = divisionData as DivisionTree;

export type SelectOption = { value: string; label: string };

const EMPTY: SelectOption = { value: '', label: 'Seleccionar' };

function sortByLabel(a: SelectOption, b: SelectOption) {
  return a.label.localeCompare(b.label, 'es');
}

function resolveProvincia(codeOrName: string | null | undefined) {
  if (!codeOrName) return null;
  const raw = String(codeOrName).trim();
  if (tree[raw]) return { code: raw, data: tree[raw] };
  const padded = /^\d+$/.test(raw) ? raw.padStart(2, '0').slice(-2) : raw;
  if (padded !== raw && tree[padded]) return { code: padded, data: tree[padded] };
  const entry = Object.entries(tree).find(([, p]) => p.nombre === raw);
  return entry ? { code: entry[0], data: entry[1] } : null;
}

function resolveDistrito(
  provinceRef: string | null | undefined,
  districtRef: string | null | undefined
) {
  const prov = resolveProvincia(provinceRef);
  if (!prov || !districtRef) return null;
  const raw = String(districtRef).trim();
  const dists = prov.data.distritos;
  if (dists[raw]) return { code: raw, data: dists[raw], prov };
  const padded = /^\d+$/.test(raw) ? raw.padStart(4, '0').slice(-4) : raw;
  if (padded !== raw && dists[padded]) return { code: padded, data: dists[padded], prov };
  const entry = Object.entries(dists).find(([, d]) => d.nombre === raw);
  return entry ? { code: entry[0], data: entry[1], prov } : null;
}

function resolveCorregimiento(
  provinceRef: string | null | undefined,
  districtRef: string | null | undefined,
  corrRef: string | null | undefined
) {
  const dist = resolveDistrito(provinceRef, districtRef);
  if (!dist || !corrRef) return null;
  const raw = String(corrRef).trim();
  const corrs = dist.data.corregimientos;
  if (corrs[raw]) return { code: raw, nombre: corrs[raw] };
  const padded = /^\d+$/.test(raw) ? raw.padStart(6, '0').slice(-6) : raw;
  if (padded !== raw && corrs[padded]) return { code: padded, nombre: corrs[padded] };
  const entry = Object.entries(corrs).find(([, nombre]) => nombre === raw);
  return entry ? { code: entry[0], nombre: entry[1] } : null;
}

/** Normaliza a código (para selects / persistencia). */
export function toProvinciaCode(codeOrName: string | null | undefined): string {
  return resolveProvincia(codeOrName)?.code ?? '';
}

export function toDistritoCode(
  provinceRef: string | null | undefined,
  districtRef: string | null | undefined
): string {
  return resolveDistrito(provinceRef, districtRef)?.code ?? '';
}

export function toCorregimientoCode(
  provinceRef: string | null | undefined,
  districtRef: string | null | undefined,
  corrRef: string | null | undefined
): string {
  return resolveCorregimiento(provinceRef, districtRef, corrRef)?.code ?? '';
}

/** Resuelve a nombre visible en UI (Entity almacena códigos). */
export function provinciaNombre(codeOrName: string | null | undefined): string {
  return resolveProvincia(codeOrName)?.data.nombre ?? codeOrName ?? '';
}

export function distritoNombre(
  provinceRef: string | null | undefined,
  districtRef: string | null | undefined
): string {
  return resolveDistrito(provinceRef, districtRef)?.data.nombre ?? districtRef ?? '';
}

export function corregimientoNombre(
  provinceRef: string | null | undefined,
  districtRef: string | null | undefined,
  corrRef: string | null | undefined
): string {
  return resolveCorregimiento(provinceRef, districtRef, corrRef)?.nombre ?? corrRef ?? '';
}

export function getProvinciaOptions(): SelectOption[] {
  return [
    EMPTY,
    ...Object.entries(tree)
      .map(([code, p]) => ({ value: code, label: p.nombre }))
      .sort(sortByLabel),
  ];
}

/** provinceRef = código o nombre */
export function getDistritoOptions(provinceRef: string): SelectOption[] {
  const prov = resolveProvincia(provinceRef);
  if (!prov) return [EMPTY];
  return [
    EMPTY,
    ...Object.entries(prov.data.distritos)
      .map(([code, d]) => ({ value: code, label: d.nombre }))
      .sort(sortByLabel),
  ];
}

export function getCorregimientoOptions(
  provinceRef: string,
  districtRef: string
): SelectOption[] {
  const dist = resolveDistrito(provinceRef, districtRef);
  if (!dist) return [EMPTY];
  return [
    EMPTY,
    ...Object.entries(dist.data.corregimientos)
      .map(([code, nombre]) => ({ value: code, label: nombre }))
      .sort(sortByLabel),
  ];
}

export { tree as divisionPoliticaTree };
