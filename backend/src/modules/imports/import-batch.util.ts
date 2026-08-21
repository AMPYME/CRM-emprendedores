import { config } from '../../config/environment';

export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getImportBatchSettings() {
  return {
    rowBatchSize: config.importBatchSize,
    rowBatchDelayMs: config.importBatchDelayMs,
    stagingInsertBatchSize: config.importStagingInsertBatchSize,
  };
}

export async function runInBatches<T>(
  items: T[],
  batchSize: number,
  delayMs: number,
  handler: (item: T) => Promise<void>
): Promise<number> {
  let processed = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    for (const item of chunk) {
      await handler(item);
      processed += 1;
    }
    if (i + batchSize < items.length) {
      await sleep(delayMs);
    }
  }
  return processed;
}
