/**
 * Demografía del padrón leída desde la vista materializada.
 * El refresco no ocurre en cada request: solo si pasaron 30 minutos.
 */
import { prisma } from '../../config/database';
import { logger } from '../../shared/logger/logger';

const REFRESH_AFTER_MS = 30 * 60 * 1000;
const VIEW = 'mv_person_demographics';

type DemoRow = {
  gender: string;
  age_band: string;
  is_foreign: boolean;
  is_artisan: string;
  total: number;
};

export interface DemographicSlice {
  key: string;
  label: string;
  total: number;
}

const GENDER_ORDER = ['FEMALE', 'MALE', 'OTHER', 'SIN_DATO'] as const;
const AGE_ORDER = ['0-17', '18-29', '30-44', '45-59', '60+', 'SIN_DATO'] as const;

const GENDER_LABEL: Record<string, string> = {
  FEMALE: 'Femenino',
  MALE: 'Masculino',
  OTHER: 'Otro',
  SIN_DATO: 'Sin dato',
};

const AGE_LABEL: Record<string, string> = {
  '0-17': '0 a 17',
  '18-29': '18 a 29',
  '30-44': '30 a 44',
  '45-59': '45 a 59',
  '60+': '60 o más',
  SIN_DATO: 'Sin dato',
};

function bucket(rows: DemographicSlice[], order: readonly string[], labels: Record<string, string>, totals: Map<string, number>) {
  return order.map((key) => ({
    key,
    label: labels[key] || key,
    total: totals.get(key) ?? 0,
  }));
}

let refreshInFlight = false;

async function refreshIfStale(): Promise<void> {
  const state = await prisma.$queryRaw<{ refreshed_at: Date }[]>`
    SELECT refreshed_at
    FROM public.mv_refresh_state
    WHERE view_name = ${VIEW}
  `;
  const refreshedAt = state[0]?.refreshed_at ? new Date(state[0].refreshed_at).getTime() : 0;
  if (Date.now() - refreshedAt < REFRESH_AFTER_MS || refreshInFlight) return;

  refreshInFlight = true;
  try {
    await prisma.$executeRawUnsafe(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_person_demographics'
    );
    await prisma.$executeRaw`
      INSERT INTO public.mv_refresh_state (view_name, refreshed_at)
      VALUES (${VIEW}, NOW())
      ON CONFLICT (view_name) DO UPDATE SET refreshed_at = EXCLUDED.refreshed_at
    `;
  } catch (err) {
    logger.warn('No se pudo refrescar mv_person_demographics', {
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    refreshInFlight = false;
  }
}

export const demographicsService = {
  async get() {
    await refreshIfStale();
    const rows = await prisma.$queryRaw<DemoRow[]>`
      SELECT gender, age_band, is_foreign, is_artisan, total
      FROM public.mv_person_demographics
    `;

    const gender = new Map<string, number>();
    const age = new Map<string, number>();
    const foreigner = new Map<string, number>([
      ['NO', 0],
      ['SI', 0],
    ]);
    const artisan = new Map<string, number>([
      ['SI', 0],
      ['NO', 0],
      ['SIN_DATO', 0],
    ]);

    for (const row of rows) {
      const n = Number(row.total) || 0;
      gender.set(row.gender, (gender.get(row.gender) ?? 0) + n);
      age.set(row.age_band, (age.get(row.age_band) ?? 0) + n);
      const foreignKey = row.is_foreign ? 'SI' : 'NO';
      foreigner.set(foreignKey, (foreigner.get(foreignKey) ?? 0) + n);
      artisan.set(row.is_artisan, (artisan.get(row.is_artisan) ?? 0) + n);
    }

    return {
      gender: bucket([], GENDER_ORDER, GENDER_LABEL, gender),
      age: bucket([], AGE_ORDER, AGE_LABEL, age),
      foreigner: [
        { key: 'NO', label: 'Nacional', total: foreigner.get('NO') ?? 0 },
        { key: 'SI', label: 'Extranjero', total: foreigner.get('SI') ?? 0 },
      ],
      artisan: [
        { key: 'SI', label: 'Artesano', total: artisan.get('SI') ?? 0 },
        { key: 'NO', label: 'No artesano', total: artisan.get('NO') ?? 0 },
        { key: 'SIN_DATO', label: 'Sin dato', total: artisan.get('SIN_DATO') ?? 0 },
      ],
    };
  },
};
