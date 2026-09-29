import type { RowDataPacket } from 'mysql2';
import { getFormsPool } from '../../config/forms-db';
import { AppError } from '../../shared/errors/app-error';
import { ensureFormsProcedures } from './forms-procedures';
import type {
  AmpymeFormRecord,
  AmpymeFormRow,
  AmpymeFormSubmissionRow,
  AmpymeFormSubmissionsPayload,
} from './forms.types';

function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
  return false;
}

function mapRow(row: AmpymeFormRow): AmpymeFormRecord {
  return {
    id: row.id,
    form_name: row.form_name,
    description: row.description,
    created_at: row.created_at,
    event_date: row.event_date,
    expires_at: row.expires_at,
    open_at: row.open_at,
    status: row.status,
    is_draft: toBool(row.is_draft),
    is_closed: toBool(row.is_closed),
    closed_at: row.closed_at,
    inscription_limit: row.inscription_limit,
    conferencista: row.conferencista,
    ubicacion: row.ubicacion,
    submission_count: Number(row.submission_count ?? 0),
  };
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s || null;
}

function wrapDbError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  throw new AppError(
    `Error al consultar formularios en MySQL: ${message}`,
    503,
    'SERVICE_UNAVAILABLE'
  );
}

function resultSets(payload: unknown): RowDataPacket[][] {
  if (!Array.isArray(payload)) return [];
  const sets = payload.filter((entry) => Array.isArray(entry)) as RowDataPacket[][];
  if (sets.length > 0) return sets;
  return [payload as RowDataPacket[]];
}

async function callForms(sql: string, params: unknown[] = []): Promise<RowDataPacket[][]> {
  await ensureFormsProcedures();
  const pool = getFormsPool();
  const [payload] = await pool.query(sql, params);
  return resultSets(payload);
}

export const formsRepository = {
  async findAll(): Promise<AmpymeFormRecord[]> {
    try {
      const [rows] = await callForms('CALL sp_forms_list()');
      return (rows ?? []).map((row) => mapRow(row as AmpymeFormRow));
    } catch (error) {
      if (error instanceof AppError) throw error;
      wrapDbError(error);
    }
  },

  async findById(formId: number): Promise<AmpymeFormRecord | null> {
    try {
      const [rows] = await callForms('CALL sp_forms_by_id(?)', [formId]);
      if (!rows?.length) return null;
      return mapRow(rows[0] as AmpymeFormRow);
    } catch (error) {
      if (error instanceof AppError) throw error;
      wrapDbError(error);
    }
  },

  async findSubmissionsByFormId(
    formId: number,
    page: number,
    limit: number
  ): Promise<AmpymeFormSubmissionsPayload> {
    try {
      const offset = (page - 1) * limit;
      const sets = await callForms('CALL sp_form_submissions(?, ?, ?)', [formId, limit, offset]);
      const total = Number(sets[0]?.[0]?.total ?? 0);
      const totalPages = total === 0 ? 0 : Math.max(1, Math.ceil(total / limit));
      const data: AmpymeFormSubmissionRow[] = (sets[1] ?? []).map((row) => ({
        id: Number(row.id),
        user_id: Number(row.user_id),
        submitted_at: row.submitted_at ? String(row.submitted_at) : null,
        cedula: toNullableString(row.cedula),
        nombre: toNullableString(row.nombre),
        apellido: toNullableString(row.apellido),
        provincia: toNullableString(row.provincia),
        telefono: toNullableString(row.telefono),
      }));

      return {
        data,
        meta: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      wrapDbError(error);
    }
  },
};
