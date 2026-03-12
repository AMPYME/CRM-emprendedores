/**
 * Controller del módulo de eventos.
 * Endpoints CRUD para gestión de eventos.
 */
import { Request, Response } from 'express';
import { eventService } from './event.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/utils/response.utils';

export const eventController = {
  /**
   * GET /api/v1/events
   * Listado paginado de eventos con filtros.
   */
  async list(req: Request, res: Response): Promise<void> {
    const result = await eventService.list(req.query as any);
    sendPaginated(res, result.data, result.meta);
  },

  /**
   * GET /api/v1/events/:id
   * Detalle de un evento.
   */
  async getById(req: Request, res: Response): Promise<void> {
    const event = await eventService.getById(req.params.id as string);
    sendSuccess(res, event);
  },

  /**
   * POST /api/v1/events
   * Crear evento nuevo.
   */
  async create(req: Request, res: Response): Promise<void> {
    const event = await eventService.create(req.body);
    sendCreated(res, event);
  },

  /**
   * PUT /api/v1/events/:id
   * Actualizar evento existente.
   */
  async update(req: Request, res: Response): Promise<void> {
    const event = await eventService.update(req.params.id as string, req.body);
    sendSuccess(res, event);
  },

  /**
   * DELETE /api/v1/events/:id
   * Cancelar evento (soft delete → CANCELLED).
   */
  async cancel(req: Request, res: Response): Promise<void> {
    const event = await eventService.cancel(req.params.id as string);
    sendSuccess(res, event);
  },
};
