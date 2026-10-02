/**
 * Bridge de compatibilidad: un solo PrismaClient (infrastructure/database).
 */
export { db as prisma, db, createDbClient, withAppContext } from '../infrastructure/database/client';
export type { DbClient, DbTx } from '../infrastructure/database/client';
