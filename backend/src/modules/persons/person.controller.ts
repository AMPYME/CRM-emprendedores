/**
 * Controller del módulo de personas.
 * Endpoints CRUD para gestión de personas.
 */
import { Request, Response } from 'express';
import { personService } from './person.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/utils/response.utils';

export const personController = {
  /**
   * GET /api/v1/persons
   * Listado paginado de personas con filtros.
   */
  async list(req: Request, res: Response): Promise<void> {
    const result = await personService.list(req.query as any);
    sendPaginated(res, result.data, result.meta);
  },

  /**
   * GET /api/v1/persons/:id
   * Detalle de una persona.
   */
  async getById(req: Request, res: Response): Promise<void> {
    const entity = await personService.getById(req.params.id as string);
    sendSuccess(res, entity);
  },

  /**
   * POST /api/v1/persons
   * Crear persona nueva.
   */
  async create(req: Request, res: Response): Promise<void> {
    const person = await personService.create(req.body);
    sendCreated(res, person);
  },

  /**
   * PUT /api/v1/persons/:id
   * Actualizar persona existente.
   */
  async update(req: Request, res: Response): Promise<void> {
    const person = await personService.update(req.params.id as string, req.body);
    sendSuccess(res, person);
  },

  /**
   * DELETE /api/v1/persons/:id
   * Soft delete de persona (marca como INACTIVE).
   */
  async remove(req: Request, res: Response): Promise<void> {
    const result = await personService.remove(req.params.id as string);
    sendSuccess(res, result);
  },
};
