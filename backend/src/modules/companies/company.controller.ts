/**
 * Controller del módulo de empresas.
 * CREATE/UPDATE/DELETE se encolan para confirmación (igual que personas).
 */
import { Request, Response } from 'express';
import { companyService } from './company.service';
import { personChangeService } from '../person-changes/person-change.service';
import { sendSuccess, sendPaginated } from '../../shared/utils/response.utils';
import { UnauthorizedError } from '../../shared/errors/app-error';
import { AuditActor } from '../audit/audit.service';

function getActor(req: Request): AuditActor | undefined {
  if (!req.user?.id || !req.user?.email) return undefined;
  return { userId: req.user.id, userEmail: req.user.email };
}

function requireActor(req: Request): AuditActor {
  const actor = getActor(req);
  if (!actor) throw new UnauthorizedError('Usuario no autenticado');
  return actor;
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
    const queued = await personChangeService.enqueueCreateCompany(req.body, requireActor(req));
    res.status(202).json({ success: true, data: queued });
  },

  async update(req: Request, res: Response): Promise<void> {
    const queued = await personChangeService.enqueueUpdateCompany(
      req.params.id as string,
      req.body,
      requireActor(req)
    );
    res.status(202).json({ success: true, data: queued });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const queued = await personChangeService.enqueueDeleteCompany(
      req.params.id as string,
      requireActor(req)
    );
    res.status(202).json({ success: true, data: queued });
  },
};
