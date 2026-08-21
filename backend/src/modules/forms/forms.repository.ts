import type { RowDataPacket } from 'mysql2';
import { getFormsPool } from '../../config/forms-db';
import { AppError } from '../../shared/errors/app-error';
import type {
  AmpymeFormRecord,
  AmpymeFormRow,
  AmpymeFormSubmissionRow,
  AmpymeFormSubmissionsPayload,
} from './forms.types';

const LIST_SQL = `
  SELECT
    vf.id,
    vf.form_name,
    vf.description,
    vf.created_at,
    vf.event_date,
    vf.expires_at,
    vf.open_at,
    vf.status,
    vf.is_draft,
    vf.is_closed,
    vf.closed_at,
    vf.inscription_limit,
    vf.conferencista,
    vf.ubicacion,
    COALESCE(fs.submission_count, 0) AS submission_count
  FROM vw_forms vf
  LEFT JOIN (
    SELECT form_id, COUNT(*) AS submission_count
    FROM form_submissions
    GROUP BY form_id
  ) fs ON fs.form_id = vf.id
  ORDER BY vf.created_at DESC
`;

const BY_ID_SQL = `
  SELECT
    id,
    form_name,
    description,
    created_at,
    event_date,
    expires_at,
    open_at,
    status,
    is_draft,
    is_closed,
    closed_at,
    inscription_limit,
    conferencista,
    ubicacion
  FROM vw_forms
  WHERE id = ?
  LIMIT 1
`;

const SUBMISSION_COUNT_SQL = `
  SELECT COUNT(*) AS submission_count
  FROM form_submissions
  WHERE form_id = ?
`;

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

function responseTableName(formId: number): string {
  return `form_${formId}_responses`;
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

export const formsRepository = {
  async findAll(): Promise<AmpymeFormRecord[]> {
    try {
      const pool = getFormsPool();
      const [rows] = await pool.query<RowDataPacket[] & AmpymeFormRow[]>(LIST_SQL);
      return rows.map(mapRow);
    } catch (error) {
      if (error instanceof AppError) throw error;
      wrapDbError(error);
    }
  },

  async findById(formId: number): Promise<AmpymeFormRecord | null> {
    try {
      const pool = getFormsPool();
      const [rows] = await pool.query<RowDataPacket[] & AmpymeFormRow[]>(BY_ID_SQL, [formId]);
      if (!rows.length) return null;

      const form = mapRow(rows[0] as AmpymeFormRow);
      const [countRows] = await pool.query<RowDataPacket[]>(
        SUBMISSION_COUNT_SQL,
        [formId]
      );
      const count = Number(countRows[0]?.submission_count ?? 0);
      form.submission_count = Number.isFinite(count) ? count : 0;
      return form;
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
      const pool = getFormsPool();
      const offset = (page - 1) * limit;
      const respTable = responseTableName(formId);

      const [countRows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS total FROM form_submissions WHERE form_id = ?',
        [formId]
      );
      const total = Number(countRows[0]?.total ?? 0);
      const totalPages = Math.max(1, Math.ceil(total / limit));

      if (total === 0) {
        return {
          data: [],
          meta: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        };
      }

      const sql = `
        SELECT
          fs.id AS id,
          fs.user_id AS user_id,
          fs.submitted_at AS submitted_at,
          r.cedula AS cedula,
          r.nombre AS nombre,
          r.apellido AS apellido,
          r.provincia AS provincia,
          r.telefono AS telefono,
          COALESCE(r.email, u.email) AS email
        FROM form_submissions fs
        JOIN \`${respTable}\` r ON r.id = fs.response_id
        LEFT JOIN users u ON u.id = fs.user_id
        WHERE fs.form_id = ?
        ORDER BY fs.submitted_at DESC
        LIMIT ? OFFSET ?
      `;

      const [rows] = await pool.query<RowDataPacket[]>(sql, [formId, limit, offset]);

      const data: AmpymeFormSubmissionRow[] = rows.map((row) => ({
        id: Number(row.id),
        user_id: Number(row.user_id),
        submitted_at: row.submitted_at ? String(row.submitted_at) : null,
        cedula: toNullableString(row.cedula),
        nombre: toNullableString(row.nombre),
        apellido: toNullableString(row.apellido),
        provincia: toNullableString(row.provincia),
        telefono: toNullableString(row.telefono),
        email: toNullableString(row.email),
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
