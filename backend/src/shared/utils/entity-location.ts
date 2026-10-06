/**
 * Ubicación persistible: códigos oficiales + filas del catálogo (FK de entities).
 * Si provincias/distritos no están seedados, los crea desde el JSON en el mismo guardado.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { getDivisionTree, locationInputToCodes } from './division-politica';

type LocationInput = {
  province?: string | null;
  district?: string | null;
  corregimiento?: string | null;
};

type Db = typeof prisma | Prisma.TransactionClient;

function padDigits(value: string | null | undefined, len: number): string | undefined {
  if (!value) return undefined;
  const t = String(value).trim();
  if (!t) return undefined;
  if (!/^\d+$/.test(t)) return undefined;
  return t.padStart(len, '0').slice(-len);
}

function fallbackCodes(location: LocationInput) {
  const province = padDigits(location.province, 2);
  const district = padDigits(location.district, 4);
  const corregimiento = padDigits(location.corregimiento, 6);
  return {
    province,
    district: province && district?.startsWith(province) ? district : district,
    corregimiento:
      district && corregimiento?.startsWith(district) ? corregimiento : corregimiento,
  };
}

export async function persistableLocationCodes(location: LocationInput, db: Db = prisma) {
  let codes = locationInputToCodes(location);
  if (!codes.province) {
    codes = fallbackCodes(location);
  }
  if (!codes.province) {
    return { province: undefined, district: undefined, corregimiento: undefined };
  }

  const tree = getDivisionTree();
  const provData = tree[codes.province];
  const distData = codes.district ? provData?.distritos[codes.district] : undefined;
  const corrNombre =
    codes.corregimiento && distData ? distData.corregimientos[codes.corregimiento] : undefined;

  await db.provincia.upsert({
    where: { codProv: codes.province },
    create: { codProv: codes.province, nombre: provData?.nombre || codes.province },
    update: provData?.nombre ? { nombre: provData.nombre } : {},
  });
  await upsertPoliticalDivision(db, codes.province, provData?.nombre || codes.province, 'PROVINCE', null);

  let district: string | undefined;
  if (codes.district) {
    await db.distrito.upsert({
      where: { codDist: codes.district },
      create: {
        codDist: codes.district,
        nombre: distData?.nombre || codes.district,
        codProv: codes.province,
      },
      update: {
        ...(distData?.nombre ? { nombre: distData.nombre } : {}),
        codProv: codes.province,
      },
    });
    await upsertPoliticalDivision(
      db,
      codes.district,
      distData?.nombre || codes.district,
      'DISTRICT',
      codes.province
    );
    district = codes.district;
  }

  let corregimiento: string | undefined;
  if (district && codes.corregimiento) {
    await db.corregimiento.upsert({
      where: { codCorr: codes.corregimiento },
      create: {
        codCorr: codes.corregimiento,
        nombre: corrNombre || codes.corregimiento,
        codDist: district,
      },
      update: {
        ...(corrNombre ? { nombre: corrNombre } : {}),
        codDist: district,
      },
    });
    await upsertPoliticalDivision(
      db,
      codes.corregimiento,
      corrNombre || codes.corregimiento,
      'CORREGIMIENTO',
      district
    );
    corregimiento = codes.corregimiento;
  }

  return { province: codes.province, district, corregimiento };
}

async function upsertPoliticalDivision(
  db: Db,
  code: string,
  name: string,
  level: 'PROVINCE' | 'DISTRICT' | 'CORREGIMIENTO',
  parentCode: string | null
): Promise<void> {
  const label = name.trim().slice(0, 150) || code;
  try {
    await db.$executeRaw`
      INSERT INTO catalog.political_divisions (code, name, level, parent_code)
      VALUES (
        ${code},
        ${label},
        ${level}::catalog.political_division_level,
        ${parentCode}
      )
      ON CONFLICT (code) DO UPDATE
        SET name = EXCLUDED.name,
            is_active = TRUE,
            updated_at = NOW()
    `;
  } catch {
    // Si el catálogo canónico no acepta el código, las columnas cod_* igual se guardan.
  }
}
