import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { config } from '../../config/environment';
import { logger } from '../../shared/logger/logger';

const PROCEDURES = ['sp_forms_list', 'sp_forms_by_id', 'sp_form_submissions'] as const;

let installed = false;

export async function ensureFormsProcedures(): Promise<void> {
  if (installed) return;
  if (!config.formsMysql.host || !config.formsMysql.user || !config.formsMysql.database) return;

  const dir = path.resolve(__dirname, '../../../prisma/forms');
  const connection = await mysql.createConnection({
    host: config.formsMysql.host,
    port: config.formsMysql.port,
    user: config.formsMysql.user,
    password: config.formsMysql.password,
    database: config.formsMysql.database,
  });

  try {
    for (const name of PROCEDURES) {
      const sql = fs.readFileSync(path.join(dir, `${name}.sql`), 'utf8');
      await connection.query(`DROP PROCEDURE IF EXISTS ${name}`);
      await connection.query(sql);
    }
    installed = true;
  } catch (error) {
    logger.warn('No se pudieron instalar los procedimientos de formularios', {
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await connection.end();
  }
}
