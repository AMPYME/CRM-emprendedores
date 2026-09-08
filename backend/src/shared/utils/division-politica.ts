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

function resolveProvincia(codeOrName: string | null | undefined) {
  if (!codeOrName) return null;
  const tree = loadTree();
  if (tree[codeOrName]) return { code: codeOrName, data: tree[codeOrName] };
  const entry = Object.entries(tree).find(([, p]) => p.nombre === codeOrName);
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
  const entry = Object.entries(dists).find(([, d]) => d.nombre === districtRef);
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
  if (corrs[corrRef]) return { code: corrRef, nombre: corrs[corrRef] };
  const entry = Object.entries(corrs).find(([, nombre]) => nombre === corrRef);
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
