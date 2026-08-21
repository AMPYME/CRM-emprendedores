/**
 * Lectura de CSV UTF-8 por streams (sin cargar el archivo completo en memoria).
 */
import fs from 'fs';
import { parse } from 'csv-parse';
import { normalizeHeader } from './parser.service';
import { BadRequestError } from '../../shared/errors/app-error';

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
    normalized[normalizeHeader(String(key))] = cleanCell(value);
  }
  return normalized;
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

  const parser = fs.createReadStream(filePath, { encoding: 'utf8' }).pipe(
    parse({
      columns: true,
      bom: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
    })
  );

  try {
    for await (const record of parser) {
      yield normalizeRow(record as Record<string, unknown>);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error de parsing CSV';
    throw new BadRequestError(`No se pudo leer el CSV: ${message}`);
  }
}

/**
 * Lee solo la primera fila de datos + headers (para preview ligero de CSV).
 */
export async function peekCsvHeadersAndSample(
  filePath: string,
  maxRows: number = 10
): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const rows: Record<string, unknown>[] = [];
  let headers: string[] = [];

  for await (const row of iterateCsvRows(filePath)) {
    if (headers.length === 0) {
      headers = Object.keys(row);
    }
    rows.push(row);
    if (rows.length >= maxRows) break;
  }

  return { headers, rows };
}
