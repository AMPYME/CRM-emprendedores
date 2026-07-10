/**
 * Tipos del módulo de intake (MySQL temporal → WebSocket → PostgreSQL).
 * Las claves de los subtipos son snake_case porque vienen tal cual de MySQL
 * (cuyos nombres de columna = los @map de Prisma).
 */

export type IntakeStatus = 'DRAFT' | 'SUBMITTED' | 'VALIDATED' | 'EXPIRED';
export type IntakeEntityType = 'PERSON' | 'COMPANY' | 'ESTABLISHMENT';

export interface IntakeSessionRow {
  session_id: string;
  entity_type: IntakeEntityType;
  status: IntakeStatus;
  created_by: string | null;
  access_code_hash: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  expires_at: string;
}

export interface IntakePersonRow {
  intake_entity_id: string;
  cedula: string | null;
  first_name: string | null;
  last_name: string | null;
  second_last_name: string | null;
  gender: string | null;
  birth_date: string | null;
  nationality_code: string | null;
  education_level: string | null;
  occupation: string | null;
  business_name: string | null;
  economic_activity: string | null;
}

export interface IntakeCompanyRow {
  intake_entity_id: string;
  ruc: string | null;
  dv: string | null;
  legal_name: string | null;
  trade_name: string | null;
  company_type: string | null;
  economic_activity: string | null;
  founded_date: string | null;
  employee_count: number | null;
}

export interface IntakeEstablishmentRow {
  intake_entity_id: string;
  establishment_name: string | null;
  establishment_type: string | null;
  economic_activity: string | null;
  notice_of_operation: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface IntakeContactRow {
  contact_type: string;
  contact_value: string;
  label: string | null;
  is_primary: number;
}

export interface IntakeLocation {
  province: string | null;
  district: string | null;
  corregimiento: string | null;
  address: string | null;
}

/** Snapshot que se envía al frontend (REST y WebSocket). */
export interface IntakeSnapshot {
  sessionId: string;
  status: IntakeStatus;
  createdBy: string | null;
  expiresAt: string;
  lastActivityAt: string;
  displayName: string;
  entityType: IntakeEntityType;
  location: IntakeLocation;
  notes: string | null;
  person: IntakePersonRow | null;
  company: IntakeCompanyRow | null;
  establishment: IntakeEstablishmentRow | null;
  contacts: IntakeContactRow[];
}

/** Resumen para el listado de sesiones activas. */
export interface IntakeSessionSummary {
  sessionId: string;
  entityType: IntakeEntityType;
  status: IntakeStatus;
  createdBy: string | null;
  displayName: string;
  expiresAt: string;
  lastActivityAt: string;
}

export interface IntakeMigrateResult {
  sessionId: string;
  entities: Array<{ id: string; entityType: IntakeEntityType; displayName: string }>;
}

/** Eventos WebSocket → frontend. */
export type IntakeWsEvent =
  | { type: 'snapshot'; snapshot: IntakeSnapshot }
  | { type: 'expired'; sessionId: string }
  | { type: 'validated'; sessionId: string }
  | { type: 'subscribed'; sessionId: string }
  | { type: 'access_denied'; sessionId: string; message: string }
  | { type: 'error'; message: string };
