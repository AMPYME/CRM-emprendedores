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

export interface ImportVerificationLogEntry {
  at: string;
  rowNumber: number;
  name: string;
  entityType: string;
  cedula?: string | null;
  ruc?: string | null;
  message: string;
}

export interface ImportErrorLogShape {
  progress?: ImportProgressSnapshot;
  rowErrors?: ImportRowError[];
  verificationLogs?: ImportVerificationLogEntry[];
  message?: string;
  timestamp?: string;
  [key: string]: unknown;
}

const MAX_ROW_ERRORS = 500;
const MAX_VERIFICATION_LOGS = 2000;

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

  if (batch.status === 'FAILED') {
    const failMsg =
      log.message ||
      (progress?.phase === 'failed' ? progress.message : null) ||
      'La importación falló';
    return {
      processed: progress?.processed ?? 0,
      total: progress?.total || batch.totalRows,
      progressPercent: 0,
      progressMessage: failMsg,
      phase: 'failed',
    };
  }

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

/** Mensaje corto para UI (evita el dump completo de Prisma). */
export function toImportFailureMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? 'Error desconocido');
  const missingCol = raw.match(/The column `([^`]+)` does not exist/i);
  if (missingCol) {
    return `Esquema de base de datos incompleto: falta la columna ${missingCol[1]}.`;
  }
  const compact = raw.replace(/\s+/g, ' ').trim();
  if (compact.length > 400) return `${compact.slice(0, 397)}…`;
  return compact || 'Error desconocido';
}

export async function markImportFailed(batchId: string, error: unknown): Promise<string> {
  const message = toImportFailureMessage(error);
  const batch = await importRepository.findBatchById(batchId);
  if (!batch) return message;

  const log = readErrorLog(batch.errorLog);
  const nextLog: ImportErrorLogShape = {
    ...log,
    message,
    timestamp: new Date().toISOString(),
    progress: {
      processed: log.progress?.processed ?? 0,
      total: log.progress?.total || batch.totalRows || 0,
      percent: 0,
      message,
      phase: 'failed',
      updatedAt: new Date().toISOString(),
    },
  };

  await importRepository.updateBatch(batchId, {
    status: 'FAILED',
    completedAt: new Date(),
    errorLog: nextLog as unknown as Prisma.InputJsonValue,
  });
  return message;
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
    appendVerificationLogs?: ImportVerificationLogEntry[];
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

  const verificationLogs = [...(log.verificationLogs || [])];
  if (input.appendVerificationLogs?.length) {
    const room = Math.max(0, MAX_VERIFICATION_LOGS - verificationLogs.length);
    if (room > 0) {
      verificationLogs.push(...input.appendVerificationLogs.slice(0, room));
    }
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
    verificationLogs,
  };

  const data: Prisma.ImportBatchUpdateInput = {
    errorLog: nextLog as unknown as Prisma.InputJsonValue,
  };
  if (input.totalRows != null) data.totalRows = input.totalRows;
  if (input.status) data.status = input.status;
  if (input.status === 'VERIFICATION_QUEUED') data.completedAt = new Date();

  await importRepository.updateBatch(batchId, data);
}
