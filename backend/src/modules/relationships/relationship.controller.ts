/**
 * Controller del módulo de relaciones entre entidades.
 * Endpoints HTTP para gestionar EntityRelationship.
 */
import type { Request, Response } from 'express';
import { relationshipService } from './relationship.service';
import { sendSuccess, sendCreated, sendNoContent } from '../../shared/utils/response.utils';
import { AuditActor } from '../audit/audit.service';

function getActor(req: Request): AuditActor | undefined {
  if (!req.user?.id || !req.user?.email) return undefined;
  return { userId: req.user.id, userEmail: req.user.email };
}

export const relationshipController = {
  /**
   * GET /api/v1/entities/:entityId/relationships
   * Lista relaciones asociadas a una entidad.
   */
  async listByEntity(req: Request, res: Response): Promise<void> {
    const entityId = req.params.entityId as string;
    const relationships = await relationshipService.listByEntity(entityId, req.query as any);
    sendSuccess(res, relationships);
  },

  /**
   * POST /api/v1/entities/:entityId/relationships
   * Crea una nueva relación desde una entidad hacia otra.
   */
  async create(req: Request, res: Response): Promise<void> {
    const entityId = req.params.entityId as string;
    const relationship = await relationshipService.create(entityId, req.body, getActor(req));
    sendCreated(res, relationship);
  },

  /**
   * PUT /api/v1/relationships/:id
   * Actualiza una relación existente.
   */
  async update(req: Request, res: Response): Promise<void> {
    const relationship = await relationshipService.update(req.params.id as string, req.body, getActor(req));
    sendSuccess(res, relationship);
  },

  /**
   * DELETE /api/v1/relationships/:id
   * Soft delete: marca la relación como inactiva.
   */
  async remove(req: Request, res: Response): Promise<void> {
    await relationshipService.remove(req.params.id as string, getActor(req));
    sendNoContent(res);
  },
};

