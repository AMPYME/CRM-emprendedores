/**
 * Controller del módulo de entidades.
 * Endpoints para búsqueda cross-type y detalle de entidades.
 */
import { Request, Response } from 'express';
import { entityService } from './entity.service';
import { sendSuccess, sendPaginated } from '../../shared/utils/response.utils';
import { AuditActor } from '../audit/audit.service';

function getActor(req: Request): AuditActor | undefined {
  if (!req.user?.id || !req.user?.email) return undefined;
  return { userId: req.user.id, userEmail: req.user.email };
}

export const entityController = {
  /**
   * GET /api/v1/entities
   * Listado paginado con búsqueda cross-type.
   */
  async list(req: Request, res: Response): Promise<void> {
    const result = await entityService.list(req.query as any);
    sendPaginated(res, result.data, result.meta);
  },

  /**
   * GET /api/v1/entities/:id
   * Detalle completo de una entidad.
   */
  async getById(req: Request, res: Response): Promise<void> {
    const entity = await entityService.getById(req.params.id as string);
    sendSuccess(res, entity);
  },

  /**
   * PATCH /api/v1/entities/:id/registro-empresarial
   * Guarda la fecha del registro. fecha null = nunca ha tenido.
   */
  async setRegistroEmpresarial(req: Request, res: Response): Promise<void> {
    const entity = await entityService.setRegistroEmpresarialFecha(
      req.params.id as string,
      req.body,
      getActor(req)
    );
    sendSuccess(res, entity);
  },

  async verificar(req: Request, res: Response): Promise<void> {
    const matches = await entityService.verificarDocumento(String(req.query.documento ?? ''));
    sendSuccess(res, matches);
  },

  async historial(req: Request, res: Response): Promise<void> {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 30;
    const result = await entityService.historial(req.params.id as string, page, limit);
    sendSuccess(res, result);
  },
};
