/**
 * Controller del módulo de personas.
 */
import { Request, Response } from 'express';
import { personService } from './person.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/utils/response.utils';
import { AuditActor } from '../audit/audit.service';

function getActor(req: Request): AuditActor | undefined {
  if (!req.user?.id || !req.user?.email) return undefined;
  return { userId: req.user.id, userEmail: req.user.email };
}

export const personController = {
  async list(req: Request, res: Response): Promise<void> {
    const result = await personService.list(req.query as any);
    sendPaginated(res, result.data, result.meta);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const entity = await personService.getById(req.params.id as string);
    sendSuccess(res, entity);
  },

  async create(req: Request, res: Response): Promise<void> {
    const person = await personService.create(req.body, getActor(req));
    sendCreated(res, person);
  },

  async update(req: Request, res: Response): Promise<void> {
    const person = await personService.update(req.params.id as string, req.body, getActor(req));
    sendSuccess(res, person);
  },

  async remove(req: Request, res: Response): Promise<void> {
    const result = await personService.remove(req.params.id as string, getActor(req));
    sendSuccess(res, result);
  },
};
