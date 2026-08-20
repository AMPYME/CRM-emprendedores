/**
 * Controller del módulo de empresas.
 */
import { Request, Response } from 'express';
import { companyService } from './company.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/utils/response.utils';
import { AuditActor } from '../audit/audit.service';

function getActor(req: Request): AuditActor | undefined {
  if (!req.user?.id || !req.user?.email) return undefined;
  return { userId: req.user.id, userEmail: req.user.email };
}

export const companyController = {
  async list(req: Request, res: Response): Promise<void> {
    const result = await companyService.list(req.query as any);
    sendPaginated(res, result.data, result.meta);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const entity = await companyService.getById(req.params.id as string);
    sendSuccess(res, entity);
  },

  async create(req: Request, res: Response): Promise<void> {
    const company = await companyService.create(req.body, getActor(req));
    sendCreated(res, company);
  },

  async update(req: Request, res: Response): Promise<void> {
    const company = await companyService.update(req.params.id as string, req.body, getActor(req));
    sendSuccess(res, company);
  },

  async remove(req: Request, res: Response): Promise<void> {
    const result = await companyService.remove(req.params.id as string, getActor(req));
    sendSuccess(res, result);
  },
};
