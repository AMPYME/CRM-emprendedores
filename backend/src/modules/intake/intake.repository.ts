/**
 * Acceso a la MySQL temporal (`emprendedores_intake`) para el módulo intake.
 * Solo lectura/gestión de sesiones; la escritura de datos la hace la app PHP.
 */
import { v4 as uuidv4 } from 'uuid';
import type { RowDataPacket } from 'mysql2';
import { tempDb } from '../../config/temp-db';
import { config } from '../../config/environment';
import {
  IntakeSessionRow,
  IntakeSnapshot,
  IntakeSessionSummary,
  IntakePersonRow,
  IntakeCompanyRow,
  IntakeEstablishmentRow,
  IntakeContactRow,
  IntakeStatus,
  IntakeEntityType,
} from './intake.types';
import { generateAccessCode, hashAccessCode, verifyAccessCode } from './intake-access';

function computeDisplayName(snapshot: {
  person: IntakePersonRow | null;
  company: IntakeCompanyRow | null;
  establishment: IntakeEstablishmentRow | null;
}): string {
  if (snapshot.person) {
    const parts = [snapshot.person.first_name, snapshot.person.last_name].filter(Boolean);
    if (parts.length) return parts.join(' ');
  }
  if (snapshot.company) {
    return snapshot.company.trade_name || snapshot.company.legal_name || 'Empresa';
  }
  if (snapshot.establishment) {
    return snapshot.establishment.establishment_name || 'Establecimiento';
  }
  return 'Sin datos';
}

export const intakeRepository = {
  /** Crea una nueva sesión de intake. Devuelve el session_id. */
  async createSession(
    createdBy: string | null,
    entityType: IntakeEntityType = 'PERSON'
  ): Promise<{ session: IntakeSessionRow; accessCode: string }> {
    const db = tempDb();
    const sessionId = uuidv4();
    const accessCode = generateAccessCode();
    const accessCodeHash = hashAccessCode(accessCode);
    await db.execute(
      `INSERT INTO intake_session (session_id, entity_type, status, created_by, access_code_hash, expires_at)
       VALUES (:sid, :etype, 'DRAFT', :by, :hash, DATE_ADD(NOW(), INTERVAL :ttl MINUTE))`,
      {
        sid: sessionId,
        etype: entityType,
        by: createdBy,
        hash: accessCodeHash,
        ttl: config.intakeSessionTtlMin,
      }
    );
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('No se pudo crear la sesión de intake');
    return { session, accessCode };
  },

  /** Lista creadores distintos en sesiones activas. */
  async listCreators(): Promise<string[]> {
    const db = tempDb();
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT DISTINCT created_by
         FROM intake_session
        WHERE expires_at >= NOW()
          AND status <> 'EXPIRED'
          AND created_by IS NOT NULL
          AND created_by <> ''
        ORDER BY created_by ASC`
    );
    return rows.map((r) => r.created_by as string);
  },

  /** Verifica el código de acceso de una sesión. */
  async verifySessionAccess(sessionId: string, accessCode: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;
    return verifyAccessCode(accessCode, session.access_code_hash);
  },

  /** Regenera el código de acceso (invalida el anterior). */
  async regenerateAccessCode(sessionId: string): Promise<string> {
    const db = tempDb();
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('SESSION_NOT_FOUND');
    const accessCode = generateAccessCode();
    const accessCodeHash = hashAccessCode(accessCode);
    await db.execute(
      'UPDATE intake_session SET access_code_hash = :hash WHERE session_id = :sid',
      { hash: accessCodeHash, sid: sessionId }
    );
    return accessCode;
  },

  /** Lee una sesión por id (sin filtrar expiración). */
  async getSession(sessionId: string): Promise<IntakeSessionRow | null> {
    const db = tempDb();
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM intake_session WHERE session_id = :sid',
      { sid: sessionId }
    );
    return (rows[0] as IntakeSessionRow) || null;
  },

  /** Lista sesiones activas (no expiradas), opcionalmente por estado y creador. */
  async listSessions(status?: IntakeStatus, createdBy?: string): Promise<IntakeSessionSummary[]> {
    const db = tempDb();
    const where = ["s.expires_at >= NOW()", "s.status <> 'EXPIRED'"];
    const params: Record<string, string> = {};
    if (status) {
      where.push('s.status = :status');
      params.status = status;
    }
    if (createdBy) {
      where.push('s.created_by = :createdBy');
      params.createdBy = createdBy;
    }
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT s.session_id, s.entity_type, s.status, s.created_by, s.expires_at, s.last_activity_at,
              p.first_name, p.last_name, c.legal_name, c.trade_name, e.establishment_name
         FROM intake_session s
         LEFT JOIN intake_entity pe ON pe.session_id = s.session_id AND pe.entity_type = 'PERSON'
         LEFT JOIN intake_person p  ON p.intake_entity_id = pe.id
         LEFT JOIN intake_entity ce ON ce.session_id = s.session_id AND ce.entity_type = 'COMPANY'
         LEFT JOIN intake_company c ON c.intake_entity_id = ce.id
         LEFT JOIN intake_entity ee ON ee.session_id = s.session_id AND ee.entity_type = 'ESTABLISHMENT'
         LEFT JOIN intake_establishment e ON e.intake_entity_id = ee.id
        WHERE ${where.join(' AND ')}
        ORDER BY s.last_activity_at DESC
        LIMIT 500`,
      params
    );

    return rows.map((r) => {
      const name =
        [r.first_name, r.last_name].filter(Boolean).join(' ') ||
        r.trade_name ||
        r.legal_name ||
        r.establishment_name ||
        null;
      const entityType = r.entity_type as IntakeEntityType;
      const typeFallback: Record<IntakeEntityType, string> = {
        PERSON: 'Persona (nueva)',
        COMPANY: 'Empresa (nueva)',
        ESTABLISHMENT: 'Establecimiento (nuevo)',
      };
      return {
        sessionId: r.session_id,
        entityType,
        status: r.status,
        createdBy: r.created_by,
        displayName: name || typeFallback[entityType] || 'Sin datos',
        expiresAt: r.expires_at,
        lastActivityAt: r.last_activity_at,
      };
    });
  },

  /** Construye el snapshot completo de una sesión. */
  async getSnapshot(sessionId: string): Promise<IntakeSnapshot | null> {
    const db = tempDb();
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const [entities] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM intake_entity WHERE session_id = :sid ORDER BY created_at ASC',
      { sid: sessionId }
    );

    let person: IntakePersonRow | null = null;
    let company: IntakeCompanyRow | null = null;
    let establishment: IntakeEstablishmentRow | null = null;
    const contacts: IntakeContactRow[] = [];
    let entityType: IntakeEntityType = session.entity_type || 'PERSON';
    const location = { province: null, district: null, corregimiento: null, address: null } as IntakeSnapshot['location'];
    let notes: string | null = null;

    for (const e of entities) {
      if (e.entity_type === 'PERSON') {
        entityType = 'PERSON';
        location.province = e.province;
        location.district = e.district;
        location.corregimiento = e.corregimiento;
        location.address = e.address;
        notes = e.notes;
        const [pr] = await db.execute<RowDataPacket[]>(
          'SELECT * FROM intake_person WHERE intake_entity_id = :id',
          { id: e.id }
        );
        person = (pr[0] as IntakePersonRow) || null;
      } else if (e.entity_type === 'COMPANY') {
        entityType = 'COMPANY';
        location.province = e.province ?? location.province;
        location.district = e.district ?? location.district;
        location.corregimiento = e.corregimiento ?? location.corregimiento;
        location.address = e.address ?? location.address;
        const [cr] = await db.execute<RowDataPacket[]>(
          'SELECT * FROM intake_company WHERE intake_entity_id = :id',
          { id: e.id }
        );
        company = (cr[0] as IntakeCompanyRow) || null;
      } else if (e.entity_type === 'ESTABLISHMENT') {
        entityType = 'ESTABLISHMENT';
        location.province = e.province ?? location.province;
        location.district = e.district ?? location.district;
        location.corregimiento = e.corregimiento ?? location.corregimiento;
        location.address = e.address ?? location.address;
        const [er] = await db.execute<RowDataPacket[]>(
          'SELECT * FROM intake_establishment WHERE intake_entity_id = :id',
          { id: e.id }
        );
        establishment = (er[0] as IntakeEstablishmentRow) || null;
      }

      const [cts] = await db.execute<RowDataPacket[]>(
        'SELECT contact_type, contact_value, label, is_primary FROM intake_contact WHERE intake_entity_id = :id',
        { id: e.id }
      );
      cts.forEach((c) => contacts.push(c as IntakeContactRow));
    }

    return {
      sessionId: session.session_id,
      status: session.status,
      createdBy: session.created_by,
      expiresAt: session.expires_at,
      lastActivityAt: session.last_activity_at,
      displayName: computeDisplayName({ person, company, establishment }) ||
        ({ PERSON: 'Persona (nueva)', COMPANY: 'Empresa (nueva)', ESTABLISHMENT: 'Establecimiento (nuevo)' } as const)[entityType],
      entityType,
      location,
      notes,
      person,
      company,
      establishment,
      contacts,
    };
  },

  /** Elimina una sesión (cascada borra entidades/subtipos/contactos/relaciones). */
  async deleteSession(sessionId: string): Promise<void> {
    const db = tempDb();
    await db.execute('DELETE FROM intake_session WHERE session_id = :sid', { sid: sessionId });
  },

  /** Elimina sesiones expiradas. Devuelve los ids eliminados. */
  async cleanupExpired(): Promise<string[]> {
    const db = tempDb();
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT session_id FROM intake_session WHERE expires_at < NOW() OR status = 'EXPIRED'"
    );
    const ids = rows.map((r) => r.session_id as string);
    if (ids.length > 0) {
      await db.query('DELETE FROM intake_session WHERE expires_at < NOW() OR status = ?', ['EXPIRED']);
    }
    return ids;
  },
};
