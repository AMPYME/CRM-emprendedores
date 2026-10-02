/**
 * Invocación parametrizada de procedures/functions del schema api.
 * Prohibido $queryRawUnsafe / $executeRawUnsafe.
 */
import { Prisma } from '@prisma/client';
import type { DbClient, DbTx } from './client';

type Runner = DbClient | DbTx;

export async function callApiProcedure(
  runner: Runner,
  sql: Prisma.Sql
): Promise<void> {
  await runner.$executeRaw(sql);
}

export async function queryApi<T = unknown>(
  runner: Runner,
  sql: Prisma.Sql
): Promise<T[]> {
  return runner.$queryRaw<T[]>(sql);
}

export async function queryApiFirst<T = unknown>(
  runner: Runner,
  sql: Prisma.Sql
): Promise<T | null> {
  const rows = await queryApi<T>(runner, sql);
  return rows[0] ?? null;
}
