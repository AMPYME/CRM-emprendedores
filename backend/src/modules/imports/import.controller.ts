/**
 * Controller del modulo de importaciones.
 * Endpoints para gestion de lotes de importacion, staging y procesamiento.
 */
import { Request, Response } from 'express';
import { importService } from './import.service';
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendNoContent,
} from '../../shared/utils/response.utils';
import { BadRequestError } from '../../shared/errors/app-error';
import { verificationService } from '../verifications/verification.service';

export const importController = {
  // ═══════════════════════════════════════════════════════════════
  // LOTES (ImportBatch)
  // ═══════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/imports
   * Listado paginado de lotes de importacion.
   */
  async list(req: Request, res: Response): Promise<void> {
    const result = await importService.listBatches(req.query as any);
    sendPaginated(res, result.data, result.meta);
  },

  /**
   * GET /api/v1/imports/:id
   * Detalle de un lote con estadisticas de staging.
   */
  async getById(req: Request, res: Response): Promise<void> {
    const batch = await importService.getBatch(req.params.id as string);
    sendSuccess(res, batch);
  },

  /**
   * POST /api/v1/imports/upload
   * Subir archivo Excel y crear lote de importacion.
   * Body: multipart/form-data con campo 'file' y 'sourceType'.
   */
  async upload(req: Request, res: Response): Promise<void> {
    if (!req.file) {
      throw new BadRequestError(
        'Debe enviar un archivo Excel (.xlsx, .xls) o CSV (.csv) en el campo "file"'
      );
    }

    const { sourceType, targetEventId } = req.body;

    const batch = await importService.createBatch({
      file: req.file,
      sourceType,
      targetEventId: targetEventId || undefined,
    });

    sendCreated(res, batch);
  },

  /**
   * GET /api/v1/imports/:id/preview
   * Vista previa: headers + muestra de filas + mapeo sugerido.
   */
  async preview(req: Request, res: Response): Promise<void> {
    const maxRows = parseInt(req.query.limit as string) || 10;
    const data = await importService.preview(req.params.id as string, maxRows);
    sendSuccess(res, data);
  },

  /**
   * PUT /api/v1/imports/:id/mapping
   * Actualizar mapeo de columnas de un lote.
   */
  async updateMapping(req: Request, res: Response): Promise<void> {
    const batch = await importService.updateMapping(
      req.params.id as string,
      req.body.columnMapping
    );
    sendSuccess(res, batch);
  },

  /**
   * POST /api/v1/imports/:id/process
   * Procesar el Excel: staging → validacion → deduplicacion.
   */
  async process(req: Request, res: Response): Promise<void> {
    const batch = await importService.process(req.params.id as string);
    sendSuccess(res, batch);
  },

  /**
   * POST /api/v1/imports/:id/retry
   * Reintenta el procesamiento sin re-subir el archivo.
   */
  async retry(req: Request, res: Response): Promise<void> {
    const batch = await importService.retryProcess(req.params.id as string);
    sendSuccess(res, batch);
  },

  /**
   * POST /api/v1/imports/:id/execute
   * Importar filas VALID creando entidades reales.
   */
  async execute(req: Request, res: Response): Promise<void> {
    const batch = await importService.executeImport(req.params.id as string);
    sendSuccess(res, batch);
  },

  /**
   * POST /api/v1/imports/:id/send-to-verification
   * Envía filas VALID a la cola de verificación (sin crear entidades).
   */
  async sendToVerification(req: Request, res: Response): Promise<void> {
    const result = await verificationService.sendImportToVerification(
      req.params.id as string,
      (req as Request & { user?: { id: string } }).user?.id
    );
    sendSuccess(res, result);
  },

  /**
   * POST /api/v1/imports/:id/cancel
   * Cancelar un lote de importacion.
   */
  async cancel(req: Request, res: Response): Promise<void> {
    const batch = await importService.cancelBatch(req.params.id as string);
    sendSuccess(res, batch);
  },

  /**
   * DELETE /api/v1/imports/:id
   * Eliminar un lote (solo si PENDING, CANCELLED o FAILED).
   */
  async delete(req: Request, res: Response): Promise<void> {
    await importService.deleteBatch(req.params.id as string);
    sendNoContent(res);
  },

  // ═══════════════════════════════════════════════════════════════
  // STAGING ROWS
  // ═══════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/imports/:id/rows
   * Listado paginado de filas staging de un lote.
   */
  async listRows(req: Request, res: Response): Promise<void> {
    const result = await importService.listStagingRows(
      req.params.id as string,
      req.query as any
    );
    sendPaginated(res, result.data, result.meta);
  },

  /**
   * GET /api/v1/imports/:id/rows/:rowId
   * Detalle de una fila staging.
   */
  async getRow(req: Request, res: Response): Promise<void> {
    const row = await importService.getStagingRow(
      req.params.id as string,
      req.params.rowId as string
    );
    sendSuccess(res, row);
  },

  /**
   * PUT /api/v1/imports/:id/rows/:rowId/resolve
   * Resolver una fila staging (approve/skip/link).
   */
  async resolveRow(req: Request, res: Response): Promise<void> {
    const row = await importService.resolveRow(
      req.params.id as string,
      req.params.rowId as string,
      req.body
    );
    sendSuccess(res, row);
  },

  // ═══════════════════════════════════════════════════════════════
  // UTILIDADES
  // ═══════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/imports/system-fields
   * Lista de campos del sistema disponibles para mapear.
   */
  async getSystemFields(_req: Request, res: Response): Promise<void> {
    const fields = importService.getSystemFields();
    sendSuccess(res, fields);
  },
};
