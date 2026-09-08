/**
 * División política — resolución código ↔ nombre.
 * Fuente: prisma/data/division_politica_panama.json
 */
import fs from 'fs';
import path from 'path';

type DivisionTree = Record<
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

let cached: DivisionTree | null = null;

function loadTree(): DivisionTree {
  if (cached) return cached;
  const candidates = [
    path.join(__dirname, '../../../prisma/data/division_politica_panama.json'),
    path.join(__dirname, '../../../../prisma/data/division_politica_panama.json'),
    path.join(process.cwd(), 'prisma/data/division_politica_panama.json'),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      cached = JSON.parse(fs.readFileSync(filePath, 'utf8')) as DivisionTree;
      return cached;
    }
  }
  cached = {};
  return cached;
}

export function getDivisionTree(): DivisionTree {
  return loadTree();
}

function padDigits(value: string, len: number): string {
  const t = value.trim();
  if (!/^\d+$/.test(t)) return t;
  return t.padStart(len, '0').slice(-len);
}

function resolveProvincia(codeOrName: string | null | undefined) {
  if (!codeOrName) return null;
  const raw = String(codeOrName).trim();
  const tree = loadTree();
  if (tree[raw]) return { code: raw, data: tree[raw] };
  const padded = padDigits(raw, 2);
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
  const dists = prov.data.distritos;
  if (dists[districtRef]) return { code: districtRef, data: dists[districtRef] };
  const padded = /^\d+$/.test(districtRef.trim())
    ? districtRef.trim().padStart(4, '0').slice(-4)
    : districtRef.trim();
  if (padded !== districtRef && dists[padded]) return { code: padded, data: dists[padded] };
  const entry = Object.entries(dists).find(([, d]) => d.nombre === districtRef.trim());
  return entry ? { code: entry[0], data: entry[1] } : null;
}

function resolveCorregimiento(
  provinceRef: string | null | undefined,
  districtRef: string | null | undefined,
  corrRef: string | null | undefined
) {
  const dist = resolveDistrito(provinceRef, districtRef);
  if (!dist || !corrRef) return null;
  const corrs = dist.data.corregimientos;
  const raw = corrRef.trim();
  if (corrs[raw]) return { code: raw, nombre: corrs[raw] };
  const padded = /^\d+$/.test(raw) ? raw.padStart(6, '0').slice(-6) : raw;
  if (padded !== raw && corrs[padded]) return { code: padded, nombre: corrs[padded] };
  const entry = Object.entries(corrs).find(([, nombre]) => nombre === raw);
  return entry ? { code: entry[0], nombre: entry[1] } : null;
}

/** Normaliza código o nombre de provincia a codProv (2 dígitos). */
export function toProvinciaCode(codeOrName: string | null | undefined): string | undefined {
  return resolveProvincia(codeOrName)?.code || undefined;
}

export function toDistritoCode(
  provinceRef: string | null | undefined,
  districtRef: string | null | undefined
): string | undefined {
  return resolveDistrito(provinceRef, districtRef)?.code || undefined;
}

export function toCorregimientoCode(
  provinceRef: string | null | undefined,
  districtRef: string | null | undefined,
  corrRef: string | null | undefined
): string | undefined {
  return resolveCorregimiento(provinceRef, districtRef, corrRef)?.code || undefined;
}

/** API / intake: acepta código o nombre; devuelve códigos para persistir en Entity. */
export function locationInputToCodes(location: {
  province?: string | null;
  district?: string | null;
  corregimiento?: string | null;
}) {
  const province = toProvinciaCode(location.province);
  const district = province ? toDistritoCode(province, location.district) : undefined;
  const corregimiento =
    province && district
      ? toCorregimientoCode(province, district, location.corregimiento)
      : undefined;
  return { province, district, corregimiento };
}
