/**
 * Controller del módulo intake.
 */
import { Request, Response } from 'express';
import { intakeService } from './intake.service';
import { intakeWs } from './intake.ws';
import { verificationService } from '../verifications/verification.service';
import type { VerificationDataPayload } from '../verifications/verification.types';
import { sendSuccess, sendCreated } from '../../shared/utils/response.utils';
import { IntakeStatus, IntakeEntityType } from './intake.types';

export const intakeController = {
  /** POST /intake/sessions — el operador abre una sesión y obtiene el enlace. */
  async createSession(req: Request, res: Response): Promise<void> {
    const createdBy = req.user?.id || null;
    const entityType = (req.body?.entityType as IntakeEntityType) || 'PERSON';
    const result = await intakeService.createSession(createdBy, entityType);

    if (createdBy) {
      const data: VerificationDataPayload = {
        entityType,
        snapshot: {
          entityType,
          location: { province: null, district: null, corregimiento: null, address: null },
          person: null,
          company: null,
          contacts: [],
          notes: null,
        },
      };
      await verificationService.createFieldVerification({
        intakeSessionId: result.sessionId,
        entityType,
        displayName: 'Captura en campo',
        createdById: createdBy,
        data,
      });
    }

    sendCreated(res, result);
  },

  /** GET /intake/sessions?status=SUBMITTED&createdBy=... — lista de sesiones activas. */
  async list(req: Request, res: Response): Promise<void> {
    const status = req.query.status as IntakeStatus | undefined;
    const createdBy = (req.query.createdBy as string | undefined)?.trim() || undefined;
    const sessions = await intakeService.listSessions(status, createdBy);
    const creators = await intakeService.listCreators();
    sendSuccess(res, { sessions, creators, total: sessions.length });
  },

  /** GET /intake/sessions/:id?accessCode=123456 — snapshot actual. */
  async getById(req: Request, res: Response): Promise<void> {
    const snapshot = await intakeService.getSnapshot(
      req.params.id as string,
      req.query.accessCode as string | undefined
    );
    sendSuccess(res, snapshot);
  },

  /** GET /intake/public/sessions/:id — snapshot + metadatos para el formulario público. */
  async getPublic(req: Request, res: Response): Promise<void> {
    const result = await intakeService.getPublicSession(
      req.params.id as string,
      req.query.accessCode as string | undefined
    );
    sendSuccess(res, result);
  },

  /** POST /intake/sessions/:id/verify-access — valida el código de acceso. */
  async verifyAccess(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    await intakeService.verifyAccess(id, req.body.accessCode as string);
    sendSuccess(res, { sessionId: id, verified: true });
  },

  /** POST /intake/sessions/:id/regenerate-access-code — genera un código nuevo. */
  async regenerateAccessCode(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const result = await intakeService.regenerateAccessCode(id);
    sendSuccess(res, { sessionId: id, ...result }, 201);
  },

  /** POST /intake/sessions/:id/validate — migra a entidades definitivas y borra el temporal. */
  async validate(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const result = await intakeService.validateAndMigrate(
      id,
      req.user?.id,
      req.body.accessCode as string | undefined,
      req.user?.email
    );
    intakeWs.notifyValidated(id);
    sendSuccess(res, result, 201);
  },

  /** PATCH /intake/sessions/:id — edita datos temporales. */
  async update(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const snapshot = await intakeService.updateSnapshot(
      id,
      req.body,
      req.body.accessCode as string | undefined
    );
    intakeWs.notifySnapshot(snapshot);
    sendSuccess(res, snapshot);
  },

  /** POST /intake/public/sessions/:id/submit — el emprendedor envía el formulario. */
  async submit(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const snapshot = await intakeService.submitSession(id, req.body.accessCode as string | undefined);
    intakeWs.notifySnapshot(snapshot);
    sendSuccess(res, { sessionId: id, status: snapshot.status, snapshot });
  },

  /** DELETE /intake/sessions/:id — elimina sesión temporal. */
  async remove(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    await intakeService.deleteSession(id);
    intakeWs.notifyExpired(id);
    sendSuccess(res, { sessionId: id, deleted: true });
  },
};
