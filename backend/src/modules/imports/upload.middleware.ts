/**
 * Middleware de upload de archivos CSV con Multer.
 */
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { config } from '../../config/environment';
import { BadRequestError } from '../../shared/errors/app-error';

const uploadDir = path.resolve(config.uploadDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_EXTENSIONS = ['.csv'];
const ALLOWED_MIMETYPES = [
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel', // algunos navegadores envían CSV como este MIME
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.csv';
    cb(null, `${uuidv4()}${ext === '.csv' ? '.csv' : '.csv'}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(
      new BadRequestError(
        `Tipo de archivo no permitido: ${ext}. Solo se acepta CSV UTF-8 (.csv)`
      )
    );
  }

  if (file.mimetype && !ALLOWED_MIMETYPES.includes(file.mimetype)) {
    // Algunos SO envían MIME genérico; aceptar si la extensión es .csv
    if (ext !== '.csv') {
      return cb(new BadRequestError('Tipo MIME no permitido. Use un archivo .csv'));
    }
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024,
    files: 1,
  },
});

/** Upload de un solo archivo CSV en el campo `file`. */
export const uploadExcel = upload.single('file');
export const uploadCsv = uploadExcel;
