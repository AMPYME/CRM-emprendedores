import { Request, Response } from 'express';
import { verificationService } from './verification.service';
import type { VerificationQueryInput } from './verification.validator';
import { rejectVerificationSchema } from './verification.validator';
import { canAccessImports } from '../auth/ad-auth.mapper';

export const verificationController = {
  async list(req: Request, res: Response) {
    const result = await verificationService.list(
      req.query as unknown as VerificationQueryInput,
      req.user?.id
    );
    res.json(result);
  },

  async getById(req: Request, res: Response) {
    const id = String(req.params.id);
    const detail = await verificationService.getDetail(id);
    res.json({ data: detail });
  },

  async claim(req: Request, res: Response) {
    const id = String(req.params.id);
    const result = await verificationService.claim(
      id,
      req.user!.id,
      req.user!.email
    );
    res.json({ data: result });
  },

  async release(req: Request, res: Response) {
    const id = String(req.params.id);
    const result = await verificationService.release(
      id,
      req.user!.id,
      req.user!.email,
      { force: canAccessImports(req.user!.role) }
    );
    res.json({ data: result });
  },

  async releaseAll(req: Request, res: Response) {
    const result = await verificationService.releaseAll(req.user!.id, req.user!.email);
    res.json({ data: result });
  },

  async validate(req: Request, res: Response) {
    const id = String(req.params.id);
    const result = await verificationService.validate(
      id,
      req.user!.id,
      req.user!.email
    );
    res.json({ data: result });
  },

  async reject(req: Request, res: Response) {
    const id = String(req.params.id);
    const input = rejectVerificationSchema.parse(req.body);
    const result = await verificationService.reject(
      id,
      req.user!.id,
      input,
      req.user!.email
    );
    res.json({ data: result });
  },
};
