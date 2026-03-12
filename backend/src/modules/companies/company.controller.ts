/**
 * Controller del módulo de empresas.
 * Endpoints CRUD para gestión de empresas.
 */
import { Request, Response } from 'express';
import { companyService } from './company.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/utils/response.utils';

export const companyController = {
  /**
   * GET /api/v1/companies
   * Listado paginado de empresas con filtros.
   */
  async list(req: Request, res: Response): Promise<void> {
    const result = await companyService.list(req.query as any);
    sendPaginated(res, result.data, result.meta);
  },

  /**
   * GET /api/v1/companies/:id
   * Detalle de una empresa.
   */
  async getById(req: Request, res: Response): Promise<void> {
    const entity = await companyService.getById(req.params.id as string);
    sendSuccess(res, entity);
  },

  /**
   * POST /api/v1/companies
   * Crear empresa nueva.
   */
  async create(req: Request, res: Response): Promise<void> {
    const company = await companyService.create(req.body);
    sendCreated(res, company);
  },

  /**
   * PUT /api/v1/companies/:id
   * Actualizar empresa existente.
   */
  async update(req: Request, res: Response): Promise<void> {
    const company = await companyService.update(req.params.id as string, req.body);
    sendSuccess(res, company);
  },

  /**
   * DELETE /api/v1/companies/:id
   * Soft delete de empresa (marca como INACTIVE).
   */
  async remove(req: Request, res: Response): Promise<void> {
    const result = await companyService.remove(req.params.id as string);
    sendSuccess(res, result);
  },
};
