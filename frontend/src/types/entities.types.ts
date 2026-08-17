/**
 * Tipos de entidades del dominio.
 * Espejo de los enums y modelos del backend.
 */

// ── Enums ─────────────────────────────────────────────────
export type EntityType = 'PERSON' | 'COMPANY' | 'ESTABLISHMENT';
export type EntityStatus = 'ACTIVE' | 'INACTIVE' | 'DUPLICATE' | 'MERGED';
export type ContactType = 'EMAIL' | 'PHONE' | 'MOBILE' | 'WHATSAPP' | 'WEBSITE' | 'SOCIAL_MEDIA' | 'OTHER';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type RelationshipType =
  | 'OWNER'
  | 'EMPLOYEE'
  | 'PARTNER'
  | 'BRANCH'
  | 'REPRESENTATIVE'
  | 'RELATED'
  | 'SUBSIDIARY'
  | 'AFFILIATED'
  | 'OTHER';
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type RegistrationStatus = 'REGISTERED' | 'CONFIRMED' | 'ATTENDED' | 'NO_SHOW' | 'CANCELLED';
export type PortfolioStatus = 'NEW' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
export type PortfolioPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ActionType = 'CALL' | 'EMAIL_ACTION' | 'VISIT' | 'MEETING' | 'WHATSAPP' | 'NOTE' | 'DOCUMENT' | 'STATUS_CHANGE' | 'OTHER';
export type ImportStatus = 'PENDING' | 'PROCESSING' | 'VALIDATING' | 'DEDUPLICATING' | 'REVIEW_REQUIRED' | 'IMPORTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type StagingRowStatus = 'PENDING' | 'VALID' | 'INVALID' | 'DUPLICATE_EXACT' | 'DUPLICATE_POSSIBLE' | 'IMPORTED' | 'SKIPPED' | 'ERROR';

// ── Entidades base ────────────────────────────────────────
export interface Entity {
  id: string;
  entityType: EntityType;
  status: EntityStatus;
  displayName: string;
  province: string | null; // codProv (2 dígitos)
  district: string | null; // codDist (4 dígitos)
  corregimiento: string | null; // codCorr (6 dígitos)
  address: string | null;
  notes: string | null;
  sourceOrigin: string | null;
  importBatchId: string | null;
  createdAt: string;
  updatedAt: string;
  contacts?: EntityContact[];
  person?: Person;
  company?: Company;
  establishment?: Establishment;
  _count?: { contacts: number; registrations: number; portfolios: number; relationships: number };
}

export interface Person {
  id: string;
  entityId: string;
  cedula: string | null;
  firstName: string;
  lastName: string;
  secondLastName: string | null;
  gender: Gender | null;
  birthDate: string | null;
  nationalityCode: string;
  educationLevel: string | null;
  entity?: Entity;
}

export interface Company {
  id: string;
  entityId: string;
  ruc: string | null;
  dv: string | null;
  legalName: string;
  tradeName: string | null;
  companyType: string | null;
  economicActivity: string | null;
  foundedDate: string | null;
  employeeCount: number | null;
  entity?: Entity;
}

export interface Establishment {
  id: string;
  entityId: string;
  establishmentName: string;
  establishmentType: string | null;
  economicActivity: string | null;
  noticeOfOperation: string | null;
  latitude: number | null;
  longitude: number | null;
  entity?: Entity;
}

export interface EntityContact {
  id: string;
  entityId: string;
  contactType: ContactType;
  contactValue: string;
  label: string | null;
  isPrimary: boolean;
  isVerified: boolean;
}

export interface EntityRelationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relationshipType: RelationshipType;
  role: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  fromEntity?: Entity;
  toEntity?: Entity;
}

// ── Eventos ───────────────────────────────────────────────
export interface Event {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  eventType: string | null;
  status: EventStatus;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  province: string | null;
  maxCapacity: number | null;
  formFields: unknown | null;
  createdAt: string;
  updatedAt: string;
  _count?: { registrations: number };
}

export interface EventRegistration {
  id: string;
  eventId: string;
  entityId: string;
  status: RegistrationStatus;
  registeredAt: string;
  confirmedAt: string | null;
  attendedAt: string | null;
  notes: string | null;
  sourceOrigin: string | null;
  createdAt: string;
  updatedAt: string;
  event?: Event;
  entity?: Entity;
}

// ── Cartera / Portfolio ───────────────────────────────────
export interface PortfolioRecord {
  id: string;
  entityId: string;
  assignedToId: string | null;
  status: PortfolioStatus;
  priority: PortfolioPriority;
  category: string | null;
  subject: string;
  description: string | null;
  nextFollowUpDate: string | null;
  closedAt: string | null;
  closedReason: string | null;
  createdAt: string;
  updatedAt: string;
  entity?: Entity;
  assignedTo?: { id: string; firstName: string; lastName: string; email: string };
  _count?: { actions: number };
  actions?: PortfolioAction[];
}

export interface PortfolioAction {
  id: string;
  portfolioId: string;
  performedById: string | null;
  actionType: ActionType;
  description: string;
  result: string | null;
  nextSteps: string | null;
  actionDate: string;
  createdAt: string;
  performedBy?: { id: string; firstName: string; lastName: string };
}

export interface PortfolioStats {
  total: number;
  byStatus: Record<string, number>;
  overdue: number;
  upcoming: number;
  unmanaged: number;
}

// ── Importaciones ─────────────────────────────────────────
export interface ImportBatch {
  id: string;
  fileName: string;
  originalFileName: string;
  sourceType: string;
  targetEventId: string | null;
  status: ImportStatus;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;
  skippedRows: number;
  errorLog: unknown | null;
  columnMapping: unknown | null;
  importedById: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  importedBy?: { id: string; firstName: string; lastName: string };
}

export interface StagingRow {
  id: string;
  importBatchId: string;
  rowNumber: number;
  status: StagingRowStatus;
  rawData: Record<string, unknown>;
  extractedCedula: string | null;
  extractedRuc: string | null;
  extractedFirstName: string | null;
  extractedLastName: string | null;
  extractedEmail: string | null;
  extractedPhone: string | null;
  extractedBusinessName: string | null;
  validationErrors: unknown | null;
  matchedEntityId: string | null;
  matchScore: number | null;
  matchReason: string | null;
  processedAt: string | null;
  createdAt: string;
  matchedEntity?: Entity;
}

export interface SystemField {
  key: string;
  label: string;
  group: string;
  required?: boolean;
}
