/**
 * Ubicación persistible: códigos del JSON que además existen en el catálogo de BD.
 * Si provincias/distritos no están seedados, omite la ubicación en lugar de fallar por FK.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { locationInputToCodes } from './division-politica';

type LocationInput = {
  province?: string | null;
  district?: string | null;
  corregimiento?: string | null;
};

type Db = typeof prisma | Prisma.TransactionClient;

export async function persistableLocationCodes(location: LocationInput, db: Db = prisma) {
  const codes = locationInputToCodes(location);
  if (!codes.province) {
    return { province: undefined, district: undefined, corregimiento: undefined };
  }

  const prov = await db.provincia.findUnique({
    where: { codProv: codes.province },
    select: { codProv: true },
  });
  if (!prov) {
    return { province: undefined, district: undefined, corregimiento: undefined };
  }

  let district: string | undefined;
  let corregimiento: string | undefined;

  if (codes.district) {
    const dist = await db.distrito.findUnique({
      where: { codDist: codes.district },
      select: { codDist: true, codProv: true },
    });
    if (dist && dist.codProv === codes.province) district = dist.codDist;
  }

  if (district && codes.corregimiento) {
    const corr = await db.corregimiento.findUnique({
      where: { codCorr: codes.corregimiento },
      select: { codCorr: true, codDist: true },
    });
    if (corr && corr.codDist === district) corregimiento = corr.codCorr;
  }

  return { province: codes.province, district, corregimiento };
}
