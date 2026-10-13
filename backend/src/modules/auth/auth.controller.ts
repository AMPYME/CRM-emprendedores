/**
 * Controladores del módulo de autenticación.
 */
import { Request, Response } from 'express';
import { authService } from './auth.service';
import { sendSuccess, sendCreated, sendNoContent } from '../../shared/utils/response.utils';
import {
  ExchangeInput,
  RegisterInput,
  RefreshInput,
  ChangePasswordInput,
  UpdateProfileInput,
} from './auth.validator';
import { UnauthorizedError } from '../../shared/errors/app-error';

export const authController = {
  async exchange(req: Request, res: Response): Promise<void> {
    const input = req.body as ExchangeInput;
    const result = await authService.exchange(input);
    sendSuccess(res, result);
  },

  async register(req: Request, res: Response): Promise<void> {
    const input = req.body as RegisterInput;
    const result = await authService.register(input);
    sendCreated(res, result);
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const input = req.body as RefreshInput;
    const result = await authService.refresh(input);
    sendSuccess(res, result);
  },

  /**
   * POST /auth/logout — revoca la sesión local (sid) del Bearer actual.
   */
  async logout(req: Request, res: Response): Promise<void> {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token de acceso requerido');
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedError('Token de acceso requerido');
    }
    await authService.logout(token);
    sendNoContent(res);
  },

  async getProfile(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const result = await authService.getProfile(userId);
    sendSuccess(res, result);
  },

  async updateProfile(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const input = req.body as UpdateProfileInput;
    const result = await authService.updateProfile(userId, input);
    sendSuccess(res, result);
  },

  async changePassword(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const input = req.body as ChangePasswordInput;
    await authService.changePassword(userId, input);
    sendNoContent(res);
  },
};
