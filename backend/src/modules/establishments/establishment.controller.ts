/**
 * Controller del módulo de establecimientos.
 * Endpoints CRUD para gestión de establecimientos.
 */
import { Request, Response } from 'express';
import { establishmentService } from './establishment.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/utils/response.utils';

export const establishmentController = {
  /**
   * GET /api/v1/establishments
   * Listado paginado de establecimientos con filtros.
   */
  async list(req: Request, res: Response): Promise<void> {
    const result = await establishmentService.list(req.query as any);
    sendPaginated(res, result.data, result.meta);
  },

  /**
   * GET /api/v1/establishments/:id
   * Detalle de un establecimiento.
   */
  async getById(req: Request, res: Response): Promise<void> {
    const entity = await establishmentService.getById(req.params.id as string);
    sendSuccess(res, entity);
  },

  /**
   * POST /api/v1/establishments
   * Crear establecimiento nuevo.
   */
  async create(req: Request, res: Response): Promise<void> {
    const establishment = await establishmentService.create(req.body);
    sendCreated(res, establishment);
  },

  /**
   * PUT /api/v1/establishments/:id
   * Actualizar establecimiento existente.
   */
  async update(req: Request, res: Response): Promise<void> {
    const establishment = await establishmentService.update(req.params.id as string, req.body);
    sendSuccess(res, establishment);
  },

  /**
   * DELETE /api/v1/establishments/:id
   * Soft delete de establecimiento (marca como INACTIVE).
   */
  async remove(req: Request, res: Response): Promise<void> {
    const result = await establishmentService.remove(req.params.id as string);
    sendSuccess(res, result);
  },
};
