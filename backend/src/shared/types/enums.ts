/**
 * Enums del sistema.
 * Reflejan los enums definidos en la base de datos.
 * Deben mantenerse sincronizados con el schema de Prisma.
 */

export enum EntityType {
  PERSON = 'PERSON',
  COMPANY = 'COMPANY',
}

export enum CompanySizeClass {
  MICRO = 'MICRO',
  PEQUENA = 'PEQUENA',
  MEDIANA = 'MEDIANA',
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
  OWNER = 'OWNER',                     // Dueño(a) — tip. persona→empresa/establecimiento
  EMPLOYEE = 'EMPLOYEE',               // Empleado(a)
  PARTNER = 'PARTNER',                 // Socio(a) — persona↔empresa o empresa↔empresa
  BRANCH = 'BRANCH',                   // Sucursal — tip. establecimiento→empresa
  REPRESENTATIVE = 'REPRESENTATIVE',   // Representante
  RELATED = 'RELATED',                 // Relacionado — tip. persona↔persona / genérico
  SUBSIDIARY = 'SUBSIDIARY',           // Subsidiaria — tip. empresa→empresa
  AFFILIATED = 'AFFILIATED',           // Afiliado — tip. empresa↔empresa o establecimiento↔establecimiento
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
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  EMPREND_ADMIN = 'EMPREND_ADMIN',
  EMPREND_OPERADOR = 'EMPREND_OPERADOR',
  EMPREND_VIEWER = 'EMPREND_VIEWER',
}
