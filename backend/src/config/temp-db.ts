/**
 * Pool de conexiones a la MySQL TEMPORAL (`emprendedores_intake`).
 *
 * Esta BD es escrita por la app PHP (intake) y leída por el CRM (polling) para
 * mostrar en vivo lo que el usuario externo va escribiendo. Al validar, los
 * datos se migran a PostgreSQL (Prisma) y la sesión se elimina de aquí.
 */
import mysql, { Pool } from 'mysql2/promise';
import { config } from './environment';
import { logger } from '../shared/logger/logger';

let pool: Pool | null = null;

/** Devuelve (creando si hace falta) el pool a la MySQL temporal. */
export function tempDb(): Pool {
  if (pool) return pool;
  pool = mysql.createPool({
    host: config.tempDbHost,
    port: config.tempDbPort,
    user: config.tempDbUser,
    password: config.tempDbPassword,
    database: config.tempDbName,
    waitForConnections: true,
    connectionLimit: 8,
    queueLimit: 0,
    namedPlaceholders: true,
    dateStrings: true,
    charset: 'utf8mb4_unicode_ci',
  });
  logger.info(`🗄️  Pool MySQL temporal listo (${config.tempDbHost}:${config.tempDbPort}/${config.tempDbName})`);
  return pool;
}

/** Cierra el pool (cierre limpio). */
export async function closeTempDb(): Promise<void> {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
}
