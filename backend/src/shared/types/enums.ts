/**
 * Enums del sistema.
 * Reflejan los enums definidos en la base de datos.
 * Deben mantenerse sincronizados con el schema de Prisma.
 */

export enum EntityType {
  PERSON = 'PERSON',
  COMPANY = 'COMPANY',
  ESTABLISHMENT = 'ESTABLISHMENT',
}

export enum EntityStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DUPLICATE = 'DUPLICATE',
  MERGED = 'MERGED',
}

export enum ContactType {
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  MOBILE = 'MOBILE',
  WHATSAPP = 'WHATSAPP',
  WEBSITE = 'WEBSITE',
  SOCIAL_MEDIA = 'SOCIAL_MEDIA',
  OTHER = 'OTHER',
}

export enum RelationshipType {
  OWNER = 'OWNER',           // Persona es dueña de empresa/establecimiento
  EMPLOYEE = 'EMPLOYEE',     // Persona trabaja en empresa
  PARTNER = 'PARTNER',       // Persona es socia de empresa
  BRANCH = 'BRANCH',         // Establecimiento es sucursal de empresa
  REPRESENTATIVE = 'REPRESENTATIVE', // Persona representa a empresa
  OTHER = 'OTHER',
}

export enum EventStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum RegistrationStatus {
  REGISTERED = 'REGISTERED',
  CONFIRMED = 'CONFIRMED',
  ATTENDED = 'ATTENDED',
  NO_SHOW = 'NO_SHOW',
  CANCELLED = 'CANCELLED',
}

export enum PortfolioStatus {
  NEW = 'NEW',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING = 'WAITING',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum PortfolioPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum ActionType {
  CALL = 'CALL',
  EMAIL = 'EMAIL',
  VISIT = 'VISIT',
  MEETING = 'MEETING',
  WHATSAPP = 'WHATSAPP',
  NOTE = 'NOTE',
  DOCUMENT = 'DOCUMENT',
  STATUS_CHANGE = 'STATUS_CHANGE',
  OTHER = 'OTHER',
}

export enum ImportStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  VALIDATING = 'VALIDATING',
  DEDUPLICATING = 'DEDUPLICATING',
  REVIEW_REQUIRED = 'REVIEW_REQUIRED',
  IMPORTING = 'IMPORTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum StagingRowStatus {
  PENDING = 'PENDING',
  VALID = 'VALID',
  INVALID = 'INVALID',
  DUPLICATE_EXACT = 'DUPLICATE_EXACT',
  DUPLICATE_POSSIBLE = 'DUPLICATE_POSSIBLE',
  IMPORTED = 'IMPORTED',
  SKIPPED = 'SKIPPED',
  ERROR = 'ERROR',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  ANALYST = 'ANALYST',
  OPERATOR = 'OPERATOR',
  VIEWER = 'VIEWER',
}
