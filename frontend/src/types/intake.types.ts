/**
 * Tipos del intake de emprendedores (espejo del backend).
 */
export type IntakeStatus = 'DRAFT' | 'SUBMITTED' | 'VALIDATED' | 'EXPIRED';
export type IntakeEntityType = 'PERSON' | 'COMPANY';

export interface IntakeContact {
  contact_type: string;
  contact_value: string;
  label: string | null;
  is_primary: number;
}

export interface IntakePerson {
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
  seed_capital: number | null;
  seed_capital_date: string | null;
}

export interface IntakeCompany {
  ruc: string | null;
  dv: string | null;
  legal_name: string | null;
  trade_name: string | null;
  company_type: string | null;
  company_size_class: string | null;
  economic_activity: string | null;
  founded_date: string | null;
}

export interface IntakeSnapshot {
  sessionId: string;
  status: IntakeStatus;
  createdBy: string | null;
  expiresAt: string;
  lastActivityAt: string;
  displayName: string;
  entityType: IntakeEntityType;
  location: {
    province: string | null;
    district: string | null;
    corregimiento: string | null;
    address: string | null;
  };
  notes: string | null;
  person: IntakePerson | null;
  company: IntakeCompany | null;
  contacts: IntakeContact[];
}

export interface IntakeSessionSummary {
  sessionId: string;
  entityType: IntakeEntityType;
  status: IntakeStatus;
  createdBy: string | null;
  createdByUsername: string | null;
  displayName: string;
  expiresAt: string;
  lastActivityAt: string;
}

export interface IntakeCreateResult {
  sessionId: string;
  expiresAt: string;
  entityType: IntakeEntityType;
  accessCode: string;
}

export interface IntakeSessionListResult {
  sessions: IntakeSessionSummary[];
  creators: Array<{ id: string; username: string | null }>;
  total: number;
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
