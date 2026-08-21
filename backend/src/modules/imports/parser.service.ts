/**
 * Servicio de parsing de archivos Excel.
 * Lee archivos .xlsx/.xls/.csv y extrae filas como JSON.
 */
import * as XLSX from 'xlsx';
import { ParsedExcelData } from './import.types';
import { BadRequestError } from '../../shared/errors/app-error';
import { logger } from '../../shared/logger/logger';

/**
 * Normaliza el nombre de una columna Excel para comparación.
 * Trim, lowercase, sin acentos, sin caracteres especiales.
 */
export function normalizeHeader(header: string): string {
  return header
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/\s+/g, '_');
}

/**
 * Parsea un archivo Excel y retorna headers + filas como objetos.
 *
 * @param filePath - Ruta absoluta al archivo Excel
 * @param sheetIndex - Índice de la hoja a leer (default: 0 = primera hoja)
 * @returns Headers normalizados y filas como objetos JSON
 */
export function parseExcelFile(filePath: string, sheetIndex: number = 0): ParsedExcelData {
  try {
    const workbook = XLSX.readFile(filePath, {
      type: 'file',
      cellDates: true,
      cellNF: false,
      cellText: false,
    });

    const sheetNames = workbook.SheetNames;
    if (sheetNames.length === 0) {
      throw new BadRequestError('El archivo Excel no contiene hojas');
    }

    if (sheetIndex >= sheetNames.length) {
      throw new BadRequestError(
        `Hoja ${sheetIndex} no existe. El archivo tiene ${sheetNames.length} hoja(s)`
      );
    }

    const sheet = workbook.Sheets[sheetNames[sheetIndex]];
    if (!sheet) {
      throw new BadRequestError('No se pudo leer la hoja del archivo');
    }

    // Convertir a JSON (array de objetos con headers como claves)
    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: null,
      raw: false, // Convertir todo a string para uniformidad
    });

    if (rawRows.length === 0) {
      throw new BadRequestError('El archivo Excel no contiene datos (solo headers o vacío)');
    }

    // Extraer headers originales de la primera fila
    const originalHeaders = Object.keys(rawRows[0]);

    // Crear mapping de header original → header normalizado
    const headerMapping: Record<string, string> = {};
    const normalizedHeaders: string[] = [];

    for (const header of originalHeaders) {
      const normalized = normalizeHeader(header);
      headerMapping[header] = normalized;
      normalizedHeaders.push(normalized);
    }

    // Re-mapear filas con headers normalizados
    const rows: Record<string, unknown>[] = rawRows.map((row) => {
      const normalizedRow: Record<string, unknown> = {};
      for (const [originalKey, value] of Object.entries(row)) {
        const normalizedKey = headerMapping[originalKey] || normalizeHeader(originalKey);
        // Limpiar valores: trim strings, convertir vacíos a null
        if (typeof value === 'string') {
          const trimmed = value.trim();
          normalizedRow[normalizedKey] = trimmed === '' ? null : trimmed;
        } else {
          normalizedRow[normalizedKey] = value;
        }
      }
      return normalizedRow;
    });

    logger.info(`Excel parseado: ${rows.length} filas, ${normalizedHeaders.length} columnas`, {
      file: filePath,
      headers: normalizedHeaders,
    });

    return {
      headers: normalizedHeaders,
      rows,
      totalRows: rows.length,
    };
  } catch (error) {
    if (error instanceof BadRequestError) throw error;

    logger.error('Error al parsear archivo Excel', { filePath, error });
    throw new BadRequestError(
      'No se pudo leer el archivo Excel. Verifique que el formato sea válido (.xlsx, .xls, .csv)'
    );
  }
}

/**
 * Obtiene solo los headers del archivo Excel (sin leer todas las filas).
 * Útil para la vista previa del mapeo.
 */
export function getExcelHeaders(filePath: string, sheetIndex: number = 0): string[] {
  try {
    const workbook = XLSX.readFile(filePath, {
      type: 'file',
      sheetRows: 2, // Solo leer 2 filas (header + 1 dato)
    });

    const sheetNames = workbook.SheetNames;
    if (sheetNames.length === 0 || sheetIndex >= sheetNames.length) {
      return [];
    }

    const sheet = workbook.Sheets[sheetNames[sheetIndex]];
    if (!sheet) return [];

    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: null,
    });

    if (rows.length === 0) return [];

    return Object.keys(rows[0]).map(normalizeHeader);
  } catch {
    return [];
  }
}

/**
 * Obtiene las primeras N filas del Excel para preview.
 */
export function getExcelPreview(
  filePath: string,
  maxRows: number = 10,
  sheetIndex: number = 0
): ParsedExcelData {
  try {
    const workbook = XLSX.readFile(filePath, {
      type: 'file',
      sheetRows: maxRows + 1, // +1 para el header
      cellDates: true,
    });

    const sheetNames = workbook.SheetNames;
    if (sheetNames.length === 0 || sheetIndex >= sheetNames.length) {
      return { headers: [], rows: [], totalRows: 0 };
    }

    const sheet = workbook.Sheets[sheetNames[sheetIndex]];
    if (!sheet) return { headers: [], rows: [], totalRows: 0 };

    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: null,
      raw: false,
    });

    const headers = rawRows.length > 0 ? Object.keys(rawRows[0]).map(normalizeHeader) : [];

    // Normalizar headers en las filas
    const rows = rawRows.map((row) => {
      const normalizedRow: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        normalizedRow[normalizeHeader(key)] = typeof value === 'string' ? value.trim() || null : value;
      }
      return normalizedRow;
    });

    return {
      headers,
      rows,
      totalRows: rows.length,
    };
  } catch {
    return { headers: [], rows: [], totalRows: 0 };
  }
}
