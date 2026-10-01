import { Request, Response } from 'express';
import { personChangeService } from './person-change.service';
import { sendSuccess, sendPaginated } from '../../shared/utils/response.utils';
import { UnauthorizedError } from '../../shared/errors/app-error';
import { AuditActor } from '../audit/audit.service';
import { ListMyChangeRequestsInput } from './person-change.validator';

function requireActor(req: Request): AuditActor {
  if (!req.user?.id || !req.user?.email) {
    throw new UnauthorizedError('Usuario no autenticado');
  }
  return { userId: req.user.id, userEmail: req.user.email };
}

export const personChangeController = {
  async listMine(req: Request, res: Response): Promise<void> {
    const result = await personChangeService.listMine(
      requireActor(req),
      req.query as unknown as ListMyChangeRequestsInput
    );
    sendPaginated(res, result.data, result.meta);
  },

  async hasPending(req: Request, res: Response): Promise<void> {
    const entityId = String(req.query.entityId ?? '');
    const pending = await personChangeService.hasPendingForEntity(entityId);
    sendSuccess(res, { pending });
  },

  async confirm(req: Request, res: Response): Promise<void> {
    const result = await personChangeService.confirm(req.params.id as string, requireActor(req));
    sendSuccess(res, result);
  },

  async cancel(req: Request, res: Response): Promise<void> {
    const result = await personChangeService.cancel(req.params.id as string, requireActor(req));
    sendSuccess(res, result);
  },
};
