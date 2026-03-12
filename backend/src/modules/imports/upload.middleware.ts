/**
 * Middleware de upload de archivos con Multer.
 * Configura almacenamiento en disco para archivos Excel.
 */
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { config } from '../../config/environment';
import { BadRequestError } from '../../shared/errors/app-error';

// ── Asegurar que el directorio de uploads existe ─────────────────

const uploadDir = path.resolve(config.uploadDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ── Extensiones permitidas ───────────────────────────────────────

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const ALLOWED_MIMETYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv', // .csv
  'application/csv',
];

// ── Configuración de almacenamiento ──────────────────────────────

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

// ── Filtro de archivos ───────────────────────────────────────────

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(
      new BadRequestError(
        `Tipo de archivo no permitido: ${ext}. Use: ${ALLOWED_EXTENSIONS.join(', ')}`
      )
    );
  }

  // Verificar MIME type (fallback: solo extensión)
  if (file.mimetype && !ALLOWED_MIMETYPES.includes(file.mimetype)) {
    // Algunos sistemas envían mime types genéricos; aceptar si la extensión es válida
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(
        new BadRequestError('Tipo MIME no permitido para archivos de importación')
      );
    }
  }

  cb(null, true);
};

// ── Instancia de Multer ──────────────────────────────────────────

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024, // MB → bytes
    files: 1, // Solo un archivo por request
  },
});

/**
 * Middleware para upload de un solo archivo Excel.
 * El archivo se espera en el campo 'file' del form-data.
 */
export const uploadExcel = upload.single('file');
