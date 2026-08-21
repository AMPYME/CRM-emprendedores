/**
 * Progreso de importación persistido en errorLog (sin migración de columnas).
 */
import type { ImportStatus, Prisma } from '@prisma/client';
import { importRepository } from './import.repository';

export type ImportPhase =
  | 'staging'
  | 'validation'
  | 'deduplication'
  | 'import'
  | 'verification'
  | 'done'
  | 'failed';

export interface ImportProgressSnapshot {
  processed: number;
  total: number;
  percent: number;
  message: string;
  phase: ImportPhase;
  updatedAt: string;
}

export interface ImportRowError {
  row: number;
  reason: string;
}

export interface ImportErrorLogShape {
  progress?: ImportProgressSnapshot;
  rowErrors?: ImportRowError[];
  message?: string;
  timestamp?: string;
  [key: string]: unknown;
}

const MAX_ROW_ERRORS = 500;

export function readErrorLog(raw: unknown): ImportErrorLogShape {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as ImportErrorLogShape;
}

export function buildProgressFields(batch: {
  status: ImportStatus;
  totalRows: number;
  errorLog: unknown;
}): {
  processed: number;
  total: number;
  progressPercent: number;
  progressMessage: string;
  phase: ImportPhase;
} {
  const log = readErrorLog(batch.errorLog);
  const progress = log.progress;

  if (progress) {
    return {
      processed: progress.processed,
      total: progress.total || batch.totalRows,
      progressPercent: progress.percent,
      progressMessage: progress.message,
      phase: progress.phase,
    };
  }

  const terminal: ImportStatus[] = [
    'REVIEW_REQUIRED',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'VERIFICATION_QUEUED',
  ];
  const done = terminal.includes(batch.status);
  return {
    processed: done ? batch.totalRows : 0,
    total: batch.totalRows,
    progressPercent: done ? 100 : 0,
    progressMessage: done ? 'Procesamiento completado' : 'En cola',
    phase: done ? 'done' : 'staging',
  };
}

export async function persistProgress(
  batchId: string,
  input: {
    processed: number;
    total: number;
    message: string;
    phase: ImportPhase;
    totalRows?: number;
    status?: ImportStatus;
    appendRowError?: ImportRowError;
  }
): Promise<void> {
  const batch = await importRepository.findBatchById(batchId);
  if (!batch) return;

  const log = readErrorLog(batch.errorLog);
  const total = input.total || batch.totalRows || 0;
  const percent =
    total > 0 ? Math.min(100, Math.round((input.processed / total) * 100)) : 0;

  const rowErrors = [...(log.rowErrors || [])];
  if (input.appendRowError && rowErrors.length < MAX_ROW_ERRORS) {
    rowErrors.push(input.appendRowError);
  }

  const nextLog: ImportErrorLogShape = {
    ...log,
    progress: {
      processed: input.processed,
      total,
      percent,
      message: input.message,
      phase: input.phase,
      updatedAt: new Date().toISOString(),
    },
    rowErrors,
  };

  const data: Prisma.ImportBatchUpdateInput = {
    errorLog: nextLog as Prisma.InputJsonValue,
  };
  if (input.totalRows != null) data.totalRows = input.totalRows;
  if (input.status) data.status = input.status;

  await importRepository.updateBatch(batchId, data);
}
