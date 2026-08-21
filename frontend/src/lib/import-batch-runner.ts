/**
 * Orquestación de importaciones: el backend procesa en worker;
 * el frontend hace polling de GET /imports/:id.
 */

import { importsService } from '@/services/imports.service';
import type { ImportBatch } from '@/types/entities.types';
import type { ImportBatchProgress, ImportVerificationBatchProgress } from '@/types/imports.types';

const CLIENT_BATCH_DELAY_MS = 100;
const POLL_INTERVAL_MS = 1500;

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const PROCESSING_STATUSES = new Set([
  'PROCESSING',
  'VALIDATING',
  'DEDUPLICATING',
]);

function batchToProgress(batch: ImportBatch & {
  processed?: number;
  total?: number;
  progressPercent?: number;
  progressMessage?: string;
  phase?: ImportBatchProgress['phase'];
}): ImportBatchProgress {
  const total = batch.total ?? batch.totalRows ?? 0;
  const processed = batch.processed ?? 0;
  const done = !PROCESSING_STATUSES.has(batch.status);
  return {
    batchId: batch.id,
    status: batch.status,
    phase: (batch.phase as ImportBatchProgress['phase']) || (done ? 'done' : 'staging'),
    processedInBatch: 0,
    remaining: Math.max(0, total - processed),
    totalRows: total,
    done: done && batch.status !== 'FAILED' && batch.status !== 'CANCELLED'
      ? batch.status === 'REVIEW_REQUIRED' || batch.status === 'COMPLETED' || batch.status === 'VERIFICATION_QUEUED'
      : done && (batch.status === 'FAILED' || batch.status === 'CANCELLED'),
  };
}

/**
 * Encola el proceso en el worker (202) y hace polling hasta REVIEW_REQUIRED / FAILED / CANCELLED.
 */
export async function runImportProcessBatched(
  importId: string,
  onProgress?: (progress: ImportBatchProgress) => void
): Promise<ImportBatchProgress> {
  let batch = await importsService.process(importId);
  let progress = batchToProgress(batch as ImportBatch & {
    processed?: number;
    progressPercent?: number;
    progressMessage?: string;
    phase?: ImportBatchProgress['phase'];
  });
  onProgress?.(progress);

  while (PROCESSING_STATUSES.has(batch.status)) {
    await sleep(POLL_INTERVAL_MS);
    batch = await importsService.getById(importId);
    progress = batchToProgress(batch as ImportBatch & {
      processed?: number;
      progressPercent?: number;
      progressMessage?: string;
      phase?: ImportBatchProgress['phase'];
    });
    onProgress?.(progress);
  }

  if (batch.status === 'FAILED') {
    const msg =
      (batch as { progressMessage?: string }).progressMessage ||
      'La importación falló en el servidor';
    throw new Error(msg);
  }

  return progress;
}

export async function runImportVerificationBatched(
  importId: string,
  onProgress?: (progress: ImportVerificationBatchProgress) => void
): Promise<ImportVerificationBatchProgress & { totalQueued: number }> {
  let totalQueued = 0;
  let progress = await importsService.sendToVerificationBatch(importId);
  totalQueued += progress.queued;
  onProgress?.(progress);

  while (!progress.done) {
    await sleep(CLIENT_BATCH_DELAY_MS);
    progress = await importsService.sendToVerificationBatch(importId);
    totalQueued += progress.queued;
    onProgress?.(progress);
  }

  return { ...progress, totalQueued };
}

export function progressPercentFromBatch(
  progress: ImportBatchProgress,
  validRowsHint?: number,
  serverPercent?: number
): number {
  if (typeof serverPercent === 'number' && serverPercent >= 0) {
    return serverPercent;
  }

  const total = progress.totalRows || 1;
  const processed = total - progress.remaining;

  switch (progress.phase) {
    case 'staging':
      return Math.min(40, Math.round((processed / total) * 40));
    case 'validation':
      return 40 + Math.round((processed / total) * 30);
    case 'deduplication': {
      const dedupTotal = validRowsHint || total;
      const dedupDone = Math.max(0, dedupTotal - progress.remaining);
      return 70 + Math.round((dedupDone / Math.max(dedupTotal, 1)) * 25);
    }
    case 'done':
      return 100;
    default:
      return 5;
  }
}

export function progressLabelFromBatch(
  progress: ImportBatchProgress,
  serverMessage?: string
): string {
  if (serverMessage) return serverMessage;

  switch (progress.phase) {
    case 'staging':
      return progress.remaining > 0
        ? `Cargando filas (${progress.processedInBatch || ''}…)`
        : 'Preparando archivo…';
    case 'validation':
      return progress.remaining > 0
        ? `Validando filas (${progress.remaining.toLocaleString('es-PA')} pendientes)…`
        : 'Validación completada';
    case 'deduplication':
      return progress.remaining > 0
        ? `Buscando duplicados (${progress.remaining.toLocaleString('es-PA')} pendientes)…`
        : 'Deduplicación completada';
    case 'done':
      return 'Procesamiento completado';
    default:
      return 'Procesando…';
  }
}

export function verificationProgressPercent(progress: ImportVerificationBatchProgress): number {
  if (progress.done) return 100;
  const total = progress.remaining + progress.processedInBatch;
  if (total <= 0) return 60;
  const processed = total - progress.remaining;
  return 40 + Math.round((processed / total) * 55);
}
