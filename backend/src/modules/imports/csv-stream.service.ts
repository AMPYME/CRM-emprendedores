/**
 * Lectura de CSV UTF-8 por streams (sin cargar el archivo completo en memoria).
 * Soporta delimitador coma (,) o punto y coma (;) — detectado automáticamente.
 */
import fs from 'fs';
import { parse } from 'csv-parse';
import { normalizeHeader } from './header.util';
import { BadRequestError } from '../../shared/errors/app-error';
import { logger } from '../../shared/logger/logger';

export { normalizeHeader };

function cleanCell(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  return value;
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const header = normalizeHeader(String(key));
    if (!header) continue;
    normalized[header] = cleanCell(value);
  }
  return normalized;
}

/**
 * Detecta delimitador CSV leyendo la primera línea no vacía.
 * Archivos latinoamericanos / Excel-ES suelen usar `;`.
 */
export function detectCsvDelimiter(filePath: string): ',' | ';' {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(8192);
    const bytesRead = fs.readSync(fd, buf, 0, buf.length, 0);
    let text = buf.slice(0, bytesRead).toString('utf8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) || '';
    const semis = (firstLine.match(/;/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;

    const delimiter = semis > commas ? ';' : ',';
    logger.info('CSV delimiter detectado', { filePath, delimiter, semis, commas });
    return delimiter;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Itera filas de un CSV UTF-8 una a una (backpressure nativa del stream).
 */
export async function* iterateCsvRows(
  filePath: string
): AsyncGenerator<Record<string, unknown>, void, unknown> {
  if (!fs.existsSync(filePath)) {
    throw new BadRequestError(`Archivo CSV no encontrado: ${filePath}`);
  }

  const delimiter = detectCsvDelimiter(filePath);

  const parser = fs.createReadStream(filePath, { encoding: 'utf8' }).pipe(
    parse({
      columns: true,
      bom: true,
      delimiter,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      record_delimiter: ['\n', '\r\n'],
    })
  );

  try {
    for await (const record of parser) {
      const row = normalizeRow(record as Record<string, unknown>);
      // Omitir filas totalmente vacías
      const hasValue = Object.values(row).some((v) => v !== null && v !== undefined && v !== '');
      if (!hasValue) continue;
      yield row;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error de parsing CSV';
    throw new BadRequestError(`No se pudo leer el CSV: ${message}`);
  }
}

/**
 * Lee headers + primeras N filas (preview ligero, stream).
 */
export async function peekCsvHeadersAndSample(
  filePath: string,
  maxRows: number = 10
): Promise<{ headers: string[]; rows: Record<string, unknown>[]; totalSampled: number }> {
  const rows: Record<string, unknown>[] = [];
  let headers: string[] = [];

  for await (const row of iterateCsvRows(filePath)) {
    if (headers.length === 0) {
      headers = Object.keys(row);
    }
    rows.push(row);
    if (rows.length >= maxRows) break;
  }

  if (headers.length === 0) {
    throw new BadRequestError(
      'El CSV no tiene columnas válidas. Use UTF-8 con separador coma (,) o punto y coma (;).'
    );
  }

  return { headers, rows, totalSampled: rows.length };
}

/**
 * Solo headers (sin materializar muchas filas).
 */
export async function getCsvHeaders(filePath: string): Promise<string[]> {
  const { headers } = await peekCsvHeadersAndSample(filePath, 1);
  return headers;
}
