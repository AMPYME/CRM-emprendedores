import { Request, Response } from 'express';
import { capitalSemillaService } from './capital-semilla.service';
import {
  CapitalSemillaQueryInput,
  CapitalSemillaFechaInput,
  LinkCapitalSemillaInput,
} from './capital-semilla.validator';
import { sendSuccess, sendPaginated } from '../../shared/utils/response.utils';
import { UnauthorizedError } from '../../shared/errors/app-error';
import { AuditActor } from '../audit/audit.service';
import { personChangeService } from '../person-changes/person-change.service';

function getActor(req: Request): AuditActor | undefined {
  if (!req.user?.id || !req.user?.email) return undefined;
  return { userId: req.user.id, userEmail: req.user.email };
}

function requireActor(req: Request): AuditActor {
  const actor = getActor(req);
  if (!actor) throw new UnauthorizedError('Usuario no autenticado');
  return actor;
}

export const capitalSemillaController = {
  async list(req: Request, res: Response): Promise<void> {
    const result = await capitalSemillaService.list(req.query as unknown as CapitalSemillaQueryInput);
    sendPaginated(res, result.data, result.meta);
  },

  async verificar(req: Request, res: Response): Promise<void> {
    const matches = await capitalSemillaService.verificarCedula(String(req.query.documento ?? ''));
    sendSuccess(res, matches);
  },

  /**
   * Encola asignación/quita de fecha de capital semilla (confirmación requerida).
   */
  async setFecha(req: Request, res: Response): Promise<void> {
    const body = req.body as CapitalSemillaFechaInput;
    const queued = await personChangeService.enqueueCapitalSemilla(
      req.params.id as string,
      body.linkedAt ?? null,
      requireActor(req)
    );
    res.status(202).json({ success: true, data: queued });
  },

  async link(req: Request, res: Response): Promise<void> {
    const result = await capitalSemillaService.link(
      req.params.id as string,
      req.body as LinkCapitalSemillaInput,
      getActor(req)
    );
    sendSuccess(res, result);
  },
};
