/**
 * Escritura del snapshot en MySQL temporal (espejo de save.php).
 */
import { v4 as uuidv4 } from 'uuid';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { config } from '../../config/environment';
import { IntakeEntityType } from './intake.types';
import { DEFAULT_NATIONALITY_CODE, resolveNationalityCode } from '../../shared/utils/nationality';

export interface IntakeUpdateBody {
  person?: Record<string, string | undefined>;
  company?: Record<string, string | number | undefined>;
  establishment?: Record<string, string | number | undefined>;
  location?: Record<string, string | undefined>;
  contacts?: Array<{
    contactType: string;
    contactValue: string;
    label?: string;
    isPrimary?: boolean;
  }>;
  notes?: string;
}

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

const CONTACT_TYPES = ['EMAIL', 'PHONE', 'MOBILE', 'WHATSAPP', 'WEBSITE', 'SOCIAL_MEDIA', 'OTHER'] as const;

export async function replaceIntakeSnapshot(
  db: Pool,
  sessionId: string,
  entityType: IntakeEntityType,
  body: IntakeUpdateBody
): Promise<void> {
  const person = body.person ?? {};
  const company = body.company ?? {};
  const establishment = body.establishment ?? {};
  const location = body.location ?? {};
  const contacts = body.contacts ?? [];
  const notes = clean(body.notes);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM intake_entity WHERE session_id = ?', [sessionId]);

    let primaryEntityId: string | null = null;

    if (entityType === 'PERSON') {
      primaryEntityId = uuidv4();
      const displayName =
        [clean(person.firstName), clean(person.lastName)].filter(Boolean).join(' ') || 'Sin nombre';
      const gender = clean(person.gender)?.toUpperCase();
      const genderVal =
        gender === 'MALE' || gender === 'FEMALE' || gender === 'OTHER' ? gender : null;

      await conn.execute(
        `INSERT INTO intake_entity
           (id, session_id, entity_type, display_name, province, district, corregimiento, address, notes, source_origin)
         VALUES (?, ?, 'PERSON', ?, ?, ?, ?, ?, ?, 'EMPRENDEDORES_INTAKE')`,
        [
          primaryEntityId,
          sessionId,
          displayName,
          clean(location.province),
          clean(location.district),
          clean(location.corregimiento),
          clean(location.address),
          notes,
        ]
      );
      await conn.execute(
        `INSERT INTO intake_person
           (intake_entity_id, cedula, first_name, last_name, second_last_name, gender, birth_date,
            nationality_code, education_level, occupation, business_name, economic_activity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`,
        [
          primaryEntityId,
          clean(person.cedula),
          clean(person.firstName),
          clean(person.lastName),
          clean(person.secondLastName),
          genderVal,
          clean(person.birthDate),
          resolveNationalityCode(clean(person.nationalityCode) ?? DEFAULT_NATIONALITY_CODE),
          clean(person.educationLevel),
        ]
      );
    } else if (entityType === 'COMPANY') {
      primaryEntityId = uuidv4();
      const displayName =
        clean(company.tradeName) ?? clean(company.legalName) ?? 'Empresa sin nombre';
      const employeeCount =
        company.employeeCount !== undefined && company.employeeCount !== ''
          ? parseInt(String(company.employeeCount), 10)
          : null;

      await conn.execute(
        `INSERT INTO intake_entity
           (id, session_id, entity_type, display_name, province, district, corregimiento, address, notes, source_origin)
         VALUES (?, ?, 'COMPANY', ?, ?, ?, ?, ?, ?, 'EMPRENDEDORES_INTAKE')`,
        [
          primaryEntityId,
          sessionId,
          displayName,
          clean(location.province),
          clean(location.district),
          clean(location.corregimiento),
          clean(location.address),
          notes,
        ]
      );
      await conn.execute(
        `INSERT INTO intake_company
           (intake_entity_id, ruc, dv, legal_name, trade_name, company_type, economic_activity, founded_date, employee_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          primaryEntityId,
          clean(company.ruc),
          clean(company.dv),
          clean(company.legalName),
          clean(company.tradeName),
          clean(company.companyType),
          clean(company.economicActivity),
          clean(company.foundedDate),
          Number.isFinite(employeeCount) ? employeeCount : null,
        ]
      );
    } else if (entityType === 'ESTABLISHMENT') {
      primaryEntityId = uuidv4();
      const displayName = clean(establishment.establishmentName) ?? 'Establecimiento sin nombre';

      await conn.execute(
        `INSERT INTO intake_entity
           (id, session_id, entity_type, display_name, province, district, corregimiento, address, notes, source_origin)
         VALUES (?, ?, 'ESTABLISHMENT', ?, ?, ?, ?, ?, ?, 'EMPRENDEDORES_INTAKE')`,
        [
          primaryEntityId,
          sessionId,
          displayName,
          clean(location.province),
          clean(location.district),
          clean(location.corregimiento),
          clean(location.address),
          notes,
        ]
      );
      await conn.execute(
        `INSERT INTO intake_establishment
           (intake_entity_id, establishment_name, establishment_type, economic_activity, notice_of_operation, latitude, longitude)
         VALUES (?, ?, ?, ?, ?, NULL, NULL)`,
        [
          primaryEntityId,
          clean(establishment.establishmentName),
          clean(establishment.establishmentType),
          clean(establishment.economicActivity),
          clean(establishment.noticeOfOperation),
        ]
      );
    }

    if (primaryEntityId) {
      for (const c of contacts) {
        const val = clean(c.contactValue);
        if (!val) continue;
        let type = (c.contactType || 'OTHER').toUpperCase();
        if (!CONTACT_TYPES.includes(type as (typeof CONTACT_TYPES)[number])) type = 'OTHER';
        await conn.execute(
          `INSERT INTO intake_contact (id, intake_entity_id, contact_type, contact_value, label, is_primary)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), primaryEntityId, type, val, clean(c.label), c.isPrimary ? 1 : 0]
        );
      }
    }

    const ttl = config.intakeSessionTtlMin;
    await conn.execute(
      `UPDATE intake_session
          SET status = IF(status='SUBMITTED','SUBMITTED','DRAFT'),
              last_activity_at = NOW(),
              expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
        WHERE session_id = ?`,
      [ttl, sessionId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Comprueba que la sesión exista y no esté expirada. */
export async function assertIntakeSessionActive(
  db: Pool,
  sessionId: string
): Promise<RowDataPacket> {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT * FROM intake_session WHERE session_id = ?',
    [sessionId]
  );
  const row = rows[0];
  if (!row) throw new Error('SESSION_NOT_FOUND');
  if (row.status === 'EXPIRED' || new Date(row.expires_at) < new Date()) {
    throw new Error('SESSION_EXPIRED');
  }
  return row;
}
