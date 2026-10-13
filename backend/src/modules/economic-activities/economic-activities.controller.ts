/**
 * Controller REST — catálogo CINU 4.1 y actividades por entidad.
 *
 * Catálogo:
 *   GET /api/v1/economic-activities/categories
 *   GET /api/v1/economic-activities/divisions?category_id=
 *   GET /api/v1/economic-activities/groups?division_id=
 *   GET /api/v1/economic-activities/classes?group_id=
 *   GET /api/v1/economic-activities/subclasses?class_id=
 *   GET /api/v1/economic-activities/search?q=
 *
 * Entidad:
 *   GET    /api/v1/entities/:entityId/economic-activities
 *   POST   /api/v1/entities/:entityId/economic-activities
 *   PATCH  /api/v1/entities/:entityId/economic-activities/:activityId
 *   DELETE /api/v1/entities/:entityId/economic-activities/:activityId
 */
import { Request, Response } from 'express';
import { economicActivitiesService } from './economic-activities.service';
import { sendSuccess, sendCreated } from '../../shared/utils/response.utils';
import type { AuditActor } from '../audit/audit.service';
import type {
  AssignEconomicActivityInput,
  CinuSearchQuery,
} from './economic-activities.validator';

function getActor(req: Request): AuditActor | undefined {
  if (!req.user?.id || !req.user?.email) return undefined;
  return { userId: req.user.id, userEmail: req.user.email };
}

export const economicActivitiesController = {
  async listCategories(req: Request, res: Response): Promise<void> {
    const versionCode =
      typeof req.query.version_code === 'string' ? req.query.version_code : undefined;
    const data = await economicActivitiesService.listCategories(versionCode);
    sendSuccess(res, data);
  },

  async listDivisions(req: Request, res: Response): Promise<void> {
    const data = await economicActivitiesService.listDivisions(String(req.query.category_id));
    sendSuccess(res, data);
  },

  async listGroups(req: Request, res: Response): Promise<void> {
    const data = await economicActivitiesService.listGroups(String(req.query.division_id));
    sendSuccess(res, data);
  },

  async listClasses(req: Request, res: Response): Promise<void> {
    const data = await economicActivitiesService.listClasses(String(req.query.group_id));
    sendSuccess(res, data);
  },

  async listSubclasses(req: Request, res: Response): Promise<void> {
    const data = await economicActivitiesService.listSubclasses(String(req.query.class_id));
    sendSuccess(res, data);
  },

  async search(req: Request, res: Response): Promise<void> {
    const data = await economicActivitiesService.search(req.query as unknown as CinuSearchQuery);
    sendSuccess(res, data);
  },

  async listByEntity(req: Request, res: Response): Promise<void> {
    const data = await economicActivitiesService.listByEntity(String(req.params.entityId));
    sendSuccess(res, data);
  },

  async assign(req: Request, res: Response): Promise<void> {
    const data = await economicActivitiesService.assign(
      String(req.params.entityId),
      req.body as AssignEconomicActivityInput,
      getActor(req)
    );
    sendCreated(res, data);
  },

  async patch(req: Request, res: Response): Promise<void> {
    const data = await economicActivitiesService.setPrimary(
      String(req.params.entityId),
      String(req.params.activityId),
      getActor(req)
    );
    sendSuccess(res, data);
  },

  async remove(req: Request, res: Response): Promise<void> {
    const data = await economicActivitiesService.remove(
      String(req.params.entityId),
      String(req.params.activityId),
      getActor(req)
    );
    sendSuccess(res, data);
  },
};
