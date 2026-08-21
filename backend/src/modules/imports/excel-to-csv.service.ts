/**
 * Convierte Excel (.xlsx/.xls) a CSV UTF-8 en disco mediante stream,
 * para que el procesamiento masivo solo lea CSV fila a fila.
 */
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { logger } from '../../shared/logger/logger';
import { BadRequestError } from '../../shared/errors/app-error';
import { normalizeHeader } from './parser.service';

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text: string;
  if (value instanceof Date) {
    text = value.toISOString();
  } else if (typeof value === 'object') {
    const obj = value as { text?: string; result?: unknown; richText?: Array<{ text: string }> };
    if (Array.isArray(obj.richText)) {
      text = obj.richText.map((t) => t.text).join('');
    } else if (obj.text != null) {
      text = String(obj.text);
    } else if (obj.result != null) {
      text = String(obj.result);
    } else {
      text = String(value);
    }
  } else {
    text = String(value);
  }

  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function cellValues(row: ExcelJS.Row): string[] {
  const values = row.values as Array<unknown>;
  const cells = values.slice(1);
  let end = cells.length;
  while (end > 0 && (cells[end - 1] === null || cells[end - 1] === undefined || cells[end - 1] === '')) {
    end -= 1;
  }
  return cells.slice(0, end).map(escapeCsvCell);
}

/**
 * Fallback para .xls / si falla el stream: escribe CSV por filas
 * (carga el workbook una vez, no el array de staging).
 */
async function convertWithXlsxLib(
  excelPath: string,
  csvPath: string
): Promise<{ headers: string[]; dataRows: number }> {
  const workbook = XLSX.readFile(excelPath, { type: 'file', cellDates: true, raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new BadRequestError('El archivo Excel no contiene hojas');
  }
  const sheet = workbook.Sheets[sheetName];
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];

  if (matrix.length < 2) {
    throw new BadRequestError('El archivo Excel no contiene datos (solo headers o vacío)');
  }

  const writer = fs.createWriteStream(csvPath, { encoding: 'utf8' });
  writer.write('\uFEFF');

  const writeLine = (line: string) =>
    new Promise<void>((resolve, reject) => {
      if (writer.write(line)) resolve();
      else {
        writer.once('drain', () => resolve());
        writer.once('error', reject);
      }
    });

  const headerRow = (matrix[0] || []).map((c) => escapeCsvCell(c));
  const headers = headerRow.map((c, i) => normalizeHeader(c || `col_${i + 1}`));
  await writeLine(headerRow.join(',') + '\n');

  let dataRows = 0;
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i] || [];
    if (row.every((c) => c === null || c === undefined || String(c).trim() === '')) continue;
    await writeLine(row.map((c) => escapeCsvCell(c)).join(',') + '\n');
    dataRows += 1;
  }

  await new Promise<void>((resolve, reject) => {
    writer.end(() => resolve());
    writer.on('error', reject);
  });

  workbook.SheetNames.length = 0;

  if (dataRows === 0) {
    if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    throw new BadRequestError('El archivo Excel no contiene datos (solo headers o vacío)');
  }

  return { headers, dataRows };
}

/**
 * Escribe un CSV UTF-8 a partir de la primera hoja del Excel.
 */
export async function convertExcelFileToCsv(
  excelPath: string,
  csvPath: string
): Promise<{ headers: string[]; dataRows: number }> {
  const ext = path.extname(excelPath).toLowerCase();
  if (ext === '.xls') {
    const result = await convertWithXlsxLib(excelPath, csvPath);
    logger.info('Excel (.xls) convertido a CSV', { excelPath, csvPath, ...result });
    return result;
  }

  const writer = fs.createWriteStream(csvPath, { encoding: 'utf8' });
  writer.write('\uFEFF');

  let headers: string[] = [];
  let dataRows = 0;
  let headerWritten = false;
  let sheetHandled = false;

  const writeLine = (line: string) =>
    new Promise<void>((resolve, reject) => {
      if (writer.write(line)) {
        resolve();
      } else {
        writer.once('drain', () => resolve());
        writer.once('error', reject);
      }
    });

  try {
    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(excelPath, {
      entries: 'emit',
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      styles: 'ignore',
      worksheets: 'emit',
    });

    for await (const worksheetReader of workbookReader) {
      if (sheetHandled) {
        for await (const _unused of worksheetReader) {
          /* drain other sheets */
        }
        continue;
      }
      sheetHandled = true;

      for await (const row of worksheetReader) {
        const cells = cellValues(row as ExcelJS.Row);
        if (cells.length === 0 || cells.every((c) => c === '')) continue;

        if (!headerWritten) {
          headers = cells.map((c, i) => normalizeHeader(c || `col_${i + 1}`));
          await writeLine(cells.join(',') + '\n');
          headerWritten = true;
          continue;
        }

        await writeLine(cells.join(',') + '\n');
        dataRows += 1;
      }
    }
  } catch (error) {
    writer.destroy();
    if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    logger.warn('Stream ExcelJS falló; intentando fallback XLSX', {
      excelPath,
      error: error instanceof Error ? error.message : error,
    });
    return convertWithXlsxLib(excelPath, csvPath);
  }

  await new Promise<void>((resolve, reject) => {
    writer.end(() => resolve());
    writer.on('error', reject);
  });

  if (!headerWritten || dataRows === 0) {
    if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    throw new BadRequestError('El archivo Excel no contiene datos (solo headers o vacío)');
  }

  logger.info('Excel convertido a CSV (stream)', {
    excelPath,
    csvPath,
    headers: headers.length,
    dataRows,
  });

  return { headers, dataRows };
}

export function isExcelFile(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return ext === '.xlsx' || ext === '.xls';
}

export function isCsvFile(fileName: string): boolean {
  return path.extname(fileName).toLowerCase() === '.csv';
}
