/**
 * Orquestación de importaciones por lotes desde el cliente.
 * Llama al backend en chunks con pausa entre peticiones para no saturar el servidor.
 */

import { importsService } from '@/services/imports.service';
import type { ImportBatchProgress, ImportVerificationBatchProgress } from '@/types/imports.types';

const CLIENT_BATCH_DELAY_MS = 100;

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runImportProcessBatched(
  importId: string,
  onProgress?: (progress: ImportBatchProgress) => void
): Promise<ImportBatchProgress> {
  let progress = await importsService.prepareProcess(importId);
  onProgress?.(progress);

  progress = await importsService.processBatch(importId);
  onProgress?.(progress);

  while (!progress.done) {
    await sleep(CLIENT_BATCH_DELAY_MS);
    progress = await importsService.processBatch(importId);
    onProgress?.(progress);
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

export function progressPercentFromBatch(progress: ImportBatchProgress, validRowsHint?: number): number {
  const total = progress.totalRows || 1;
  const processed = total - progress.remaining;

  switch (progress.phase) {
    case 'staging':
      return 10;
    case 'validation':
      return 15 + Math.round((processed / total) * 35);
    case 'deduplication': {
      const dedupTotal = validRowsHint || total;
      const dedupDone = Math.max(0, dedupTotal - progress.remaining);
      return 55 + Math.round((dedupDone / Math.max(dedupTotal, 1)) * 40);
    }
    case 'done':
      return 100;
    default:
      return 5;
  }
}

export function progressLabelFromBatch(progress: ImportBatchProgress): string {
  switch (progress.phase) {
    case 'staging':
      return 'Preparando archivo…';
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
