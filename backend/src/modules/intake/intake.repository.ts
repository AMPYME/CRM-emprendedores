/**
 * Acceso Prisma a las tablas temporales de intake en PostgreSQL.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
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
import { ttlExpiresAt } from './intake-ttl';

const SNAPSHOT_INCLUDE = {
  entities: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      person: true,
      company: true,
      establishment: true,
      contacts: true,
    },
  },
} satisfies Prisma.IntakeSessionInclude;

type SessionWithEntities = Prisma.IntakeSessionGetPayload<{ include: typeof SNAPSHOT_INCLUDE }>;

function iso(value: Date | null | undefined): string {
  return value ? value.toISOString() : '';
}

function dateOnly(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function typeFallback(entityType: IntakeEntityType): string {
  const map: Record<IntakeEntityType, string> = {
    PERSON: 'Persona (nueva)',
    COMPANY: 'Empresa (nueva)',
    ESTABLISHMENT: 'Establecimiento (nuevo)',
  };
  return map[entityType];
}

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

function toSessionRow(session: {
  id: string;
  entityType: IntakeEntityType;
  status: IntakeStatus;
  createdBy: string | null;
  accessCodeHash: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
}): IntakeSessionRow {
  return {
    session_id: session.id,
    entity_type: session.entityType,
    status: session.status,
    created_by: session.createdBy,
    access_code_hash: session.accessCodeHash,
    created_at: iso(session.createdAt),
    updated_at: iso(session.updatedAt),
    last_activity_at: iso(session.lastActivityAt),
    expires_at: iso(session.expiresAt),
  };
}

function mapSnapshot(session: SessionWithEntities): IntakeSnapshot {
  let person: IntakePersonRow | null = null;
  let company: IntakeCompanyRow | null = null;
  let establishment: IntakeEstablishmentRow | null = null;
  const contacts: IntakeContactRow[] = [];
  let entityType: IntakeEntityType = session.entityType;
  const location = {
    province: null as string | null,
    district: null as string | null,
    corregimiento: null as string | null,
    address: null as string | null,
  };
  let notes: string | null = null;

  for (const entity of session.entities) {
    entityType = entity.entityType;
    location.province = entity.province ?? location.province;
    location.district = entity.district ?? location.district;
    location.corregimiento = entity.corregimiento ?? location.corregimiento;
    location.address = entity.address ?? location.address;
    if (entity.notes) notes = entity.notes;

    if (entity.person) {
      const p = entity.person;
      person = {
        intake_entity_id: p.intakeEntityId,
        cedula: p.cedula,
        first_name: p.firstName,
        last_name: p.lastName,
        second_last_name: p.secondLastName,
        gender: p.gender,
        birth_date: dateOnly(p.birthDate),
        nationality_code: p.nationalityCode,
        education_level: p.educationLevel,
        occupation: p.occupation,
        business_name: p.businessName,
        economic_activity: p.economicActivity,
      };
    }
    if (entity.company) {
      const c = entity.company;
      company = {
        intake_entity_id: c.intakeEntityId,
        ruc: c.ruc,
        dv: c.dv,
        legal_name: c.legalName,
        trade_name: c.tradeName,
        company_type: c.companyType,
        economic_activity: c.economicActivity,
        founded_date: dateOnly(c.foundedDate),
        employee_count: c.employeeCount,
      };
    }
    if (entity.establishment) {
      const e = entity.establishment;
      establishment = {
        intake_entity_id: e.intakeEntityId,
        establishment_name: e.establishmentName,
        establishment_type: e.establishmentType,
        economic_activity: e.economicActivity,
        notice_of_operation: e.noticeOfOperation,
        latitude: e.latitude,
        longitude: e.longitude,
      };
    }
    for (const contact of entity.contacts) {
      contacts.push({
        contact_type: contact.contactType,
        contact_value: contact.contactValue,
        label: contact.label,
        is_primary: contact.isPrimary ? 1 : 0,
      });
    }
  }

  return {
    sessionId: session.id,
    status: session.status,
    createdBy: session.createdBy,
    expiresAt: iso(session.expiresAt),
    lastActivityAt: iso(session.lastActivityAt),
    displayName:
      computeDisplayName({ person, company, establishment }) || typeFallback(entityType),
    entityType,
    location,
    notes,
    person,
    company,
    establishment,
    contacts,
  };
}

export const intakeRepository = {
  /** Crea una nueva sesión de intake. Devuelve el session_id. */
  async createSession(
    createdBy: string | null,
    entityType: IntakeEntityType = 'PERSON'
  ): Promise<{ session: IntakeSessionRow; accessCode: string }> {
    const accessCode = generateAccessCode();
    const session = await prisma.intakeSession.create({
      data: {
        entityType,
        status: 'DRAFT',
        createdBy,
        accessCodeHash: hashAccessCode(accessCode),
        expiresAt: ttlExpiresAt(),
      },
    });
    return { session: toSessionRow(session), accessCode };
  },

  /** Lista creadores distintos en sesiones activas. */
  async listCreators(): Promise<string[]> {
    const rows = await prisma.intakeSession.findMany({
      where: {
        expiresAt: { gte: new Date() },
        status: { notIn: ['EXPIRED', 'VALIDATED'] },
        createdBy: { not: null },
      },
      distinct: ['createdBy'],
      select: { createdBy: true },
      orderBy: { createdBy: 'asc' },
    });
    return rows.map((r) => r.createdBy).filter((v): v is string => !!v && v !== '');
  },

  /** Verifica el código de acceso de una sesión. */
  async verifySessionAccess(sessionId: string, accessCode: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;
    return verifyAccessCode(accessCode, session.access_code_hash);
  },

  /** Regenera el código de acceso (invalida el anterior). */
  async regenerateAccessCode(sessionId: string): Promise<string> {
    const session = await prisma.intakeSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new Error('SESSION_NOT_FOUND');
    const accessCode = generateAccessCode();
    await prisma.intakeSession.update({
      where: { id: sessionId },
      data: { accessCodeHash: hashAccessCode(accessCode) },
    });
    return accessCode;
  },

  /** Lee una sesión por id (sin filtrar expiración). */
  async getSession(sessionId: string): Promise<IntakeSessionRow | null> {
    const session = await prisma.intakeSession.findUnique({ where: { id: sessionId } });
    return session ? toSessionRow(session) : null;
  },

  /** Lista sesiones activas (no expiradas ni validadas), opcionalmente por estado y creador. */
  async listSessions(status?: IntakeStatus, createdBy?: string): Promise<IntakeSessionSummary[]> {
    const sessions = await prisma.intakeSession.findMany({
      where: {
        expiresAt: { gte: new Date() },
        status: status ?? { notIn: ['EXPIRED', 'VALIDATED'] },
        ...(createdBy ? { createdBy } : {}),
      },
      include: SNAPSHOT_INCLUDE,
      orderBy: { lastActivityAt: 'desc' },
      take: 500,
    });

    return sessions.map((session) => {
      const snapshot = mapSnapshot(session);
      return {
        sessionId: session.id,
        entityType: snapshot.entityType,
        status: session.status,
        createdBy: session.createdBy,
        displayName: snapshot.displayName || typeFallback(snapshot.entityType),
        expiresAt: iso(session.expiresAt),
        lastActivityAt: iso(session.lastActivityAt),
      };
    });
  },

  /** Construye el snapshot completo de una sesión. */
  async getSnapshot(sessionId: string): Promise<IntakeSnapshot | null> {
    const session = await prisma.intakeSession.findUnique({
      where: { id: sessionId },
      include: SNAPSHOT_INCLUDE,
    });
    return session ? mapSnapshot(session) : null;
  },

  /** Elimina una sesión (cascada borra entidades/subtipos/contactos/relaciones). */
  async deleteSession(sessionId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const db = tx ?? prisma;
    await db.intakeSession.delete({ where: { id: sessionId } }).catch((err: unknown) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return;
      }
      throw err;
    });
  },

  /** Elimina sesiones expiradas. Devuelve los ids eliminados. */
  async cleanupExpired(): Promise<string[]> {
    const expired = await prisma.intakeSession.findMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { status: 'EXPIRED' }],
      },
      select: { id: true },
    });
    const ids = expired.map((r) => r.id);
    if (ids.length > 0) {
      await prisma.intakeSession.deleteMany({
        where: { id: { in: ids } },
      });
    }
    return ids;
  },
};
