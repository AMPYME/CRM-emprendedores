/**
 * Pool MySQL de solo lectura hacia la base de formularios AMPYME (forms_ampyme).
 */
import mysql from 'mysql2/promise';
import { config } from './environment';
import { AppError } from '../shared/errors/app-error';

let pool: mysql.Pool | null = null;

export function isFormsDbConfigured(): boolean {
  return Boolean(
    config.formsMysql.host &&
      config.formsMysql.user &&
      config.formsMysql.database
  );
}

export function getFormsPool(): mysql.Pool {
  if (!isFormsDbConfigured()) {
    throw new AppError(
      'Base de datos de formularios no configurada. Defina FORMS_MYSQL_* en el backend.',
      503,
      'SERVICE_UNAVAILABLE'
    );
  }

  if (!pool) {
    pool = mysql.createPool({
      host: config.formsMysql.host,
      port: config.formsMysql.port,
      user: config.formsMysql.user,
      password: config.formsMysql.password,
      database: config.formsMysql.database,
      waitForConnections: true,
      connectionLimit: 10,
      connectTimeout: 10_000,
      dateStrings: true,
    });
  }

  return pool;
}

export async function pingFormsDb(): Promise<boolean> {
  if (!isFormsDbConfigured()) return false;
  try {
    const conn = await getFormsPool().getConnection();
    try {
      await conn.ping();
      return true;
    } finally {
      conn.release();
    }
  } catch {
    return false;
  }
}
