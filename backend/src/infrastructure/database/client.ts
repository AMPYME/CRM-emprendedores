/**
 * Cliente Prisma de la frontera DB.
 * Soft-delete middleware aplica a lecturas legacy CRUD durante el cutover.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { config } from '../../config/environment';
import { registerSoftDelete } from '../../config/soft-delete';

const globalForDb = globalThis as unknown as {
  dbClient: PrismaClient | undefined;
};

export function createDbClient(): PrismaClient {
  const client = new PrismaClient({
    log:
      config.nodeEnv === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
  });
  registerSoftDelete(client);
  return client;
}

export const db = globalForDb.dbClient ?? createDbClient();

if (config.nodeEnv !== 'production') {
  globalForDb.dbClient = db;
}

export type DbClient = PrismaClient;
export type DbTx = Prisma.TransactionClient;

export async function withAppContext<T>(
  actorUserId: string | null | undefined,
  requestId: string | null | undefined,
  fn: (tx: DbTx) => Promise<T>
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`
      CALL api.sp_set_app_context(
        ${actorUserId ?? null}::text,
        ${requestId ?? null}::text,
        ${null}::text
      )
    `;
    return fn(tx);
  });
}
