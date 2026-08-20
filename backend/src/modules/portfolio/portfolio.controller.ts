/**
 * Controller del módulo de cartera/seguimiento.
 * Endpoints para gestión de cartera y acciones de seguimiento.
 */
import { Request, Response } from 'express';
import { portfolioService } from './portfolio.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/utils/response.utils';

export const portfolioController = {
  /**
   * GET /api/v1/portfolios
   * Listado paginado de registros de cartera con filtros.
   * Soporta vistas especiales: ?view=overdue|upcoming|unmanaged
   */
  async list(req: Request, res: Response): Promise<void> {
    const result = await portfolioService.list(req.query as any);
    sendPaginated(res, result.data, result.meta);
  },

  /**
   * GET /api/v1/portfolios/stats
   * Estadísticas generales de cartera.
   */
  async getStats(req: Request, res: Response): Promise<void> {
    const stats = await portfolioService.getStats();
    sendSuccess(res, stats);
  },

  /**
   * GET /api/v1/entities/:entityId/portfolios
   * Registros de cartera de una entidad.
   */
  async listByEntity(req: Request, res: Response): Promise<void> {
    const records = await portfolioService.listByEntity(req.params.entityId as string);
    sendSuccess(res, records);
  },

  /**
   * GET /api/v1/portfolios/:id
   * Detalle de un registro de cartera con acciones.
   */
  async getById(req: Request, res: Response): Promise<void> {
    const record = await portfolioService.getById(req.params.id as string);
    sendSuccess(res, record);
  },

  /**
   * POST /api/v1/portfolios
   * Crear registro de cartera.
   */
  async create(req: Request, res: Response): Promise<void> {
    const record = await portfolioService.create(req.body);
    sendCreated(res, record);
  },

  /**
   * PUT /api/v1/portfolios/:id
   * Actualizar registro de cartera.
   */
  async update(req: Request, res: Response): Promise<void> {
    const actor =
      req.user?.id && req.user?.email
        ? { userId: req.user.id, userEmail: req.user.email }
        : undefined;
    const record = await portfolioService.update(req.params.id as string, req.body, actor);
    sendSuccess(res, record);
  },

  /**
   * POST /api/v1/portfolios/:portfolioId/actions
   * Agregar acción a un registro de cartera.
   */
  async addAction(req: Request, res: Response): Promise<void> {
    const action = await portfolioService.addAction(
      req.params.portfolioId as string,
      req.body
    );
    sendCreated(res, action);
  },

  /**
   * GET /api/v1/portfolios/:portfolioId/actions
   * Lista acciones de un registro de cartera.
   */
  async listActions(req: Request, res: Response): Promise<void> {
    const actions = await portfolioService.listActions(
      req.params.portfolioId as string
    );
    sendSuccess(res, actions);
  },
};
