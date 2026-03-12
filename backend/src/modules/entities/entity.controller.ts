/**
 * Controller del módulo de entidades.
 * Endpoints para búsqueda cross-type y detalle de entidades.
 */
import { Request, Response } from 'express';
import { entityService } from './entity.service';
import { sendSuccess, sendPaginated } from '../../shared/utils/response.utils';

export const entityController = {
  /**
   * GET /api/v1/entities
   * Listado paginado con búsqueda cross-type.
   */
  async list(req: Request, res: Response): Promise<void> {
    const result = await entityService.list(req.query as any);
    sendPaginated(res, result.data, result.meta);
  },

  /**
   * GET /api/v1/entities/:id
   * Detalle completo de una entidad.
   */
  async getById(req: Request, res: Response): Promise<void> {
    const entity = await entityService.getById(req.params.id as string);
    sendSuccess(res, entity);
  },
};
