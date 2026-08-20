/**
 * Tipos del módulo de cola de verificación.
 */
import type { EntityType, VerificationSource, VerificationStatus } from '@prisma/client';
import type { IntakeEntityType, IntakeSnapshot } from '../intake/intake.types';
import type { ColumnMapping, ExtractedFields } from '../imports/import.types';

export type VerificationAssignmentFilter = 'all' | 'unassigned' | 'mine' | 'others';

/** Payload JSON almacenado en VerificationItem.data */
export interface VerificationDataPayload {
  entityType: IntakeEntityType;
  sourceType?: string;
  snapshot: Omit<IntakeSnapshot, 'sessionId' | 'status' | 'createdBy' | 'expiresAt' | 'lastActivityAt' | 'displayName'> & {
    displayName?: string;
  };
  importMeta?: {
    rawData: Record<string, unknown>;
    mapping: ColumnMapping;
    fields: ExtractedFields;
    sourceType: string;
    importBatchId: string;
  };
}

export interface VerificationListItem {
  id: string;
  entityType: EntityType;
  source: VerificationSource;
  status: VerificationStatus;
  displayName: string | null;
  searchCedula: string | null;
  searchRuc: string | null;
  province: string | null;
  district: string | null;
  corregimiento: string | null;
  importBatchId: string | null;
  importFileName: string | null;
  stagingRowId: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  intakeSessionId: string | null;
  validatedEntityId: string | null;
  validatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationClaimResult {
  verificationId: string;
  intakeSessionId: string;
  accessCode: string;
  status: VerificationStatus;
}

export interface VerificationValidateResult {
  verificationId: string;
  entities: Array<{ id: string; entityType: EntityType; displayName: string }>;
}
