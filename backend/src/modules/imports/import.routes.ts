/**
 * Rutas del modulo de importaciones.
 *
 * Lotes de importacion:
 *   GET    /api/v1/imports                          - listado paginado
 *   GET    /api/v1/imports/system-fields             - campos del sistema disponibles
 *   POST   /api/v1/imports/upload                    - subir archivo Excel
 *   GET    /api/v1/imports/:id                       - detalle de lote
 *   DELETE /api/v1/imports/:id                       - eliminar lote
 *   GET    /api/v1/imports/:id/preview               - vista previa del archivo
 *   PUT    /api/v1/imports/:id/mapping               - actualizar mapeo de columnas
 *   POST   /api/v1/imports/:id/process               - procesar (staging + validacion + dedup)
 *   POST   /api/v1/imports/:id/retry                 - reintentar procesamiento (sin re-subir)
 *   POST   /api/v1/imports/:id/execute               - importar filas validas
 *   POST   /api/v1/imports/:id/cancel                - cancelar lote
 *
 * Filas staging:
 *   GET    /api/v1/imports/:id/rows                  - listado paginado de staging rows
 *   GET    /api/v1/imports/:id/rows/:rowId           - detalle de fila
 *   PUT    /api/v1/imports/:id/rows/:rowId/resolve   - resolver fila (approve/skip/link)
 */
import { Router } from 'express';
import { importController } from './import.controller';
import { protect, requireFullAccess } from '../auth/auth.middleware';
import { asyncHandler } from '../../shared/utils/async-handler';
import { validate } from '../../shared/middlewares/validate.middleware';
import { uploadExcel } from './upload.middleware';
import {
  importIdParamSchema,
  rowIdParamSchema,
  uploadSchema,
  importQuerySchema,
  stagingQuerySchema,
  updateMappingSchema,
  resolveRowSchema,
  previewQuerySchema,
} from './import.validator';

export const importRoutes = Router();

// Todas las rutas de importación requieren auth + rol de administración
importRoutes.use(protect, requireFullAccess);

// ── Utilidades (antes de /:id para evitar conflicto) ──────────

importRoutes.get(
  '/system-fields',
  asyncHandler(importController.getSystemFields)
);

// ── Listado y upload ──────────────────────────────────────────

importRoutes.get(
  '/',
  validate(importQuerySchema, 'query'),
  asyncHandler(importController.list)
);

importRoutes.post(
  '/upload',
  uploadExcel,
  validate(uploadSchema, 'body'),
  asyncHandler(importController.upload)
);

// ── Operaciones sobre un lote ─────────────────────────────────

importRoutes.get(
  '/:id',
  validate(importIdParamSchema, 'params'),
  asyncHandler(importController.getById)
);

importRoutes.delete(
  '/:id',
  validate(importIdParamSchema, 'params'),
  asyncHandler(importController.delete)
);

importRoutes.get(
  '/:id/preview',
  validate(importIdParamSchema, 'params'),
  validate(previewQuerySchema, 'query'),
  asyncHandler(importController.preview)
);

importRoutes.put(
  '/:id/mapping',
  validate(importIdParamSchema, 'params'),
  validate(updateMappingSchema, 'body'),
  asyncHandler(importController.updateMapping)
);

importRoutes.post(
  '/:id/process/prepare',
  validate(importIdParamSchema, 'params'),
  asyncHandler(importController.prepareProcess)
);

importRoutes.post(
  '/:id/process/batch',
  validate(importIdParamSchema, 'params'),
  asyncHandler(importController.processBatch)
);

importRoutes.post(
  '/:id/process',
  validate(importIdParamSchema, 'params'),
  asyncHandler(importController.process)
);

importRoutes.post(
  '/:id/retry',
  validate(importIdParamSchema, 'params'),
  asyncHandler(importController.retry)
);

importRoutes.post(
  '/:id/send-to-verification/batch',
  validate(importIdParamSchema, 'params'),
  asyncHandler(importController.sendToVerificationBatch)
);

importRoutes.post(
  '/:id/send-to-verification',
  validate(importIdParamSchema, 'params'),
  asyncHandler(importController.sendToVerification)
);

importRoutes.post(
  '/:id/execute/batch',
  validate(importIdParamSchema, 'params'),
  asyncHandler(importController.executeBatch)
);

importRoutes.post(
  '/:id/execute',
  validate(importIdParamSchema, 'params'),
  asyncHandler(importController.execute)
);

importRoutes.post(
  '/:id/cancel',
  validate(importIdParamSchema, 'params'),
  asyncHandler(importController.cancel)
);

// ── Staging rows ──────────────────────────────────────────────

importRoutes.get(
  '/:id/rows',
  validate(importIdParamSchema, 'params'),
  validate(stagingQuerySchema, 'query'),
  asyncHandler(importController.listRows)
);

importRoutes.get(
  '/:id/rows/:rowId',
  validate(rowIdParamSchema, 'params'),
  asyncHandler(importController.getRow)
);

importRoutes.put(
  '/:id/rows/:rowId/resolve',
  validate(rowIdParamSchema, 'params'),
  validate(resolveRowSchema, 'body'),
  asyncHandler(importController.resolveRow)
);
