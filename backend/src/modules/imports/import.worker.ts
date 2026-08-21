/**
 * Cola in-process de importaciones (concurrencia = 1).
 * Un solo job a la vez: staging → validación → dedup.
 */
import { prisma } from '../../config/database';
import { logger } from '../../shared/logger/logger';

type ImportJob = { batchId: string };

const queue: ImportJob[] = [];
const queuedIds = new Set<string>();
let running = false;
let activeBatchId: string | null = null;

type ProcessRunner = (batchId: string) => Promise<void>;

let processRunner: ProcessRunner | null = null;

/** Evita dependencia circular: el service registra el runner al cargar. */
export function registerImportProcessRunner(runner: ProcessRunner): void {
  processRunner = runner;
}

export function getActiveImportBatchId(): string | null {
  return activeBatchId;
}

export function isImportWorkerBusy(): boolean {
  return running;
}

export function enqueueImportProcess(batchId: string): void {
  if (queuedIds.has(batchId) || activeBatchId === batchId) {
    logger.info('Import job ya en cola o activo', { batchId });
    return;
  }
  queuedIds.add(batchId);
  queue.push({ batchId });
  logger.info('Import job encolado', { batchId, queueLength: queue.length });
  void drainQueue();
}

async function drainQueue(): Promise<void> {
  if (running) return;
  running = true;

  try {
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) break;
      queuedIds.delete(job.batchId);
      activeBatchId = job.batchId;

      try {
        if (!processRunner) {
          throw new Error('Import process runner no registrado');
        }
        await processRunner(job.batchId);
      } catch (error) {
        logger.error('Import job falló', {
          batchId: job.batchId,
          error: error instanceof Error ? error.message : error,
        });
      } finally {
        activeBatchId = null;
      }
    }
  } finally {
    running = false;
  }
}

/**
 * Reencola lotes interrumpidos por reinicio del contenedor (SIGTERM/OOM).
 */
export async function resumeInterruptedImports(): Promise<void> {
  try {
    const stuck = await prisma.importBatch.findMany({
      where: {
        status: { in: ['PROCESSING', 'VALIDATING', 'DEDUPLICATING'] },
      },
      select: { id: true, status: true },
      orderBy: { updatedAt: 'asc' },
      take: 20,
    });

    if (stuck.length === 0) return;

    logger.info(`Reanudando ${stuck.length} importación(es) interrumpida(s)`);
    for (const batch of stuck) {
      enqueueImportProcess(batch.id);
    }
  } catch (error) {
    logger.warn('No se pudieron reanudar importaciones pendientes', {
      error: error instanceof Error ? error.message : error,
    });
  }
}
