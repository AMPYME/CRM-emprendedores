/**
 * Tipos del módulo de intake (PostgreSQL temporal → WebSocket → CRM).
 */

export type IntakeStatus = 'DRAFT' | 'SUBMITTED' | 'VALIDATED' | 'EXPIRED';
export type IntakeEntityType = 'PERSON' | 'COMPANY';

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
  has_artisan_card: boolean | null;
}

export interface IntakeCompanyRow {
  intake_entity_id: string;
  ruc: string | null;
  dv: string | null;
  legal_name: string | null;
  trade_name: string | null;
  company_type: string | null;
  company_size_class: string | null;
  economic_activity: string | null;
  founded_date: string | null;
  employee_count: number | null;
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
  contacts: IntakeContactRow[];
}

export interface IntakePublicSession {
  sessionId: string;
  entityType: IntakeEntityType;
  status: IntakeStatus;
  expiresAt: string;
  ttlMinutes: number;
}

export interface IntakePublicSessionResult {
  session: IntakePublicSession;
  snapshot: IntakeSnapshot;
}

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

export type IntakeWsEvent =
  | { type: 'snapshot'; snapshot: IntakeSnapshot }
  | { type: 'expired'; sessionId: string }
  | { type: 'validated'; sessionId: string }
  | { type: 'subscribed'; sessionId: string }
  | { type: 'queue_subscribed' }
  | { type: 'queue_changed'; reason?: string }
  | { type: 'access_denied'; sessionId: string; message: string }
  | { type: 'error'; message: string };
