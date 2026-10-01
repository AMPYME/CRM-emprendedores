/**
 * Controller del módulo de personas.
 */
import { Request, Response } from 'express';
import { personService } from './person.service';
import { personRepository } from './person.repository';
import { capitalSemillaService } from '../capital-semilla/capital-semilla.service';
import { personChangeService } from '../person-changes/person-change.service';
import { SaveCapitalSemillaInput } from '../capital-semilla/capital-semilla.validator';
import { sendSuccess, sendPaginated } from '../../shared/utils/response.utils';
import { UnauthorizedError, NotFoundError } from '../../shared/errors/app-error';
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

export const personController = {
  async list(req: Request, res: Response): Promise<void> {
    const result = await personService.list(req.query as any);
    sendPaginated(res, result.data, result.meta);
  },

  async lookupByCedula(req: Request, res: Response): Promise<void> {
    const entity = await personRepository.findByCedula(String(req.query.cedula ?? ''));
    if (!entity) throw new NotFoundError('Persona', String(req.query.cedula ?? ''));
    sendSuccess(res, entity);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const entity = await personService.getById(req.params.id as string);
    sendSuccess(res, entity);
  },

  async listCapitalSemilla(req: Request, res: Response): Promise<void> {
    const result = await capitalSemillaService.listByPerson(req.params.id as string);
    sendSuccess(res, result);
  },

  async saveCapitalSemilla(req: Request, res: Response): Promise<void> {
    const result = await capitalSemillaService.save(
      req.params.id as string,
      req.body as SaveCapitalSemillaInput,
      getActor(req)
    );
    sendSuccess(res, result);
  },

  async create(req: Request, res: Response): Promise<void> {
    const queued = await personChangeService.enqueueCreate(req.body, requireActor(req));
    res.status(202).json({ success: true, data: queued });
  },

  async update(req: Request, res: Response): Promise<void> {
    const queued = await personChangeService.enqueueUpdate(
      req.params.id as string,
      req.body,
      requireActor(req)
    );
    res.status(202).json({ success: true, data: queued });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const queued = await personChangeService.enqueueDelete(
      req.params.id as string,
      requireActor(req)
    );
    res.status(202).json({ success: true, data: queued });
  },
};
