/**
 * Controller del módulo de contactos.
 * Endpoints CRUD para contactos de entidades.
 * Los contactos se gestionan bajo la ruta de la entidad padre:
 *   /api/v1/entities/:entityId/contacts
 */
import { Request, Response } from 'express';
import { contactService } from './contact.service';
import { sendSuccess, sendCreated, sendNoContent } from '../../shared/utils/response.utils';
import { AuditActor } from '../audit/audit.service';

function getActor(req: Request): AuditActor | undefined {
  if (!req.user?.id || !req.user?.email) return undefined;
  return { userId: req.user.id, userEmail: req.user.email };
}

export const contactController = {
  /**
   * GET /api/v1/entities/:entityId/contacts
   * Lista todos los contactos de una entidad.
   */
  async listByEntity(req: Request, res: Response): Promise<void> {
    const contacts = await contactService.listByEntity(req.params.entityId as string);
    sendSuccess(res, contacts);
  },

  /**
   * POST /api/v1/entities/:entityId/contacts
   * Crea un contacto para una entidad.
   */
  async create(req: Request, res: Response): Promise<void> {
    const contact = await contactService.create(req.params.entityId as string, req.body, getActor(req));
    sendCreated(res, contact);
  },

  /**
   * PUT /api/v1/contacts/:id
   * Actualiza un contacto existente.
   */
  async update(req: Request, res: Response): Promise<void> {
    const contact = await contactService.update(req.params.id as string, req.body, getActor(req));
    sendSuccess(res, contact);
  },

  /**
   * DELETE /api/v1/contacts/:id
   * Elimina un contacto permanentemente.
   */
  async remove(req: Request, res: Response): Promise<void> {
    await contactService.remove(req.params.id as string, getActor(req));
    sendNoContent(res);
  },
};
