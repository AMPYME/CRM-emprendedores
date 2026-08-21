/**
 * Compat: reexporta helpers CSV. Ya no hay soporte Excel/XLSX.
 */
export { normalizeHeader } from './header.util';
export {
  iterateCsvRows,
  peekCsvHeadersAndSample,
  getCsvHeaders,
  detectCsvDelimiter,
} from './csv-stream.service';
