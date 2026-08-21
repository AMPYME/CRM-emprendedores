import type { ImportStatus } from '@/types/entities.types';

export interface ImportBatchProgress {
  batchId: string;
  status: ImportStatus;
  phase: 'staging' | 'validation' | 'deduplication' | 'import' | 'verification' | 'done';
  processedInBatch: number;
  remaining: number;
  totalRows: number;
  done: boolean;
}

export interface ImportVerificationBatchProgress {
  batchId: string;
  queued: number;
  processedInBatch: number;
  remaining: number;
  done: boolean;
}

export interface ImportExecuteBatchProgress {
  batchId: string;
  status: ImportStatus;
  processedInBatch: number;
  remaining: number;
  importedTotal: number;
  errorTotal: number;
  done: boolean;
}
