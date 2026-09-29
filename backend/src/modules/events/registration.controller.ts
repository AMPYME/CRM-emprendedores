/**
 * Controller del módulo de inscripciones a eventos.
 * Endpoints para inscripción de entidades a eventos.
 */
import { Request, Response } from 'express';
import { registrationService } from './registration.service';
import { sendSuccess, sendCreated, sendPaginated, sendNoContent } from '../../shared/utils/response.utils';

export const registrationController = {
  /**
   * GET /api/v1/events/:eventId/registrations
   * Listado paginado de inscripciones de un evento.
   */
  async listByEvent(req: Request, res: Response): Promise<void> {
    const result = await registrationService.listByEvent(
      req.params.eventId as string,
      req.query as any
    );
    sendPaginated(res, result.data, result.meta);
  },

  /**
   * GET /api/v1/entities/:entityId/registrations
   * Historial de inscripciones de una entidad (cross-event).
   */
  async listByEntity(req: Request, res: Response): Promise<void> {
    const registrations = await registrationService.listByEntity(
      req.params.entityId as string
    );
    sendSuccess(res, registrations);
  },

  /**
   * GET /api/v1/registrations/:id
   * Detalle de una inscripción.
   */
  async getById(req: Request, res: Response): Promise<void> {
    const registration = await registrationService.getById(req.params.id as string);
    sendSuccess(res, registration);
  },

  /**
   * POST /api/v1/events/:eventId/registrations
   * Inscribir entidad a un evento.
   */
  async create(req: Request, res: Response): Promise<void> {
    const registration = await registrationService.create(
      req.params.eventId as string,
      req.body
    );
    sendCreated(res, registration);
  },

  /**
   * PUT /api/v1/registrations/:id
   * Actualizar inscripción (estado, notas, timestamps).
   */
  async update(req: Request, res: Response): Promise<void> {
    const registration = await registrationService.update(
      req.params.id as string,
      req.body
    );
    sendSuccess(res, registration);
  },

  /**
   * DELETE /api/v1/registrations/:id
   * Eliminar inscripción.
   */
  async remove(req: Request, res: Response): Promise<void> {
    await registrationService.remove(req.params.id as string, req.user?.id);
    sendNoContent(res);
  },
};
