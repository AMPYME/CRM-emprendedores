/**
 * Controladores del módulo de autenticación.
 * Manejan las peticiones HTTP y delegan la lógica al servicio.
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

export const authController = {
  /**
   * POST /auth/exchange
   * Canjea el código de un solo uso de Entra por la sesión del CRM.
   */
  async exchange(req: Request, res: Response): Promise<void> {
    const input = req.body as ExchangeInput;
    const result = await authService.exchange(input);
    sendSuccess(res, result);
  },

  /**
   * POST /auth/register
   * Registra un nuevo usuario.
   */
  async register(req: Request, res: Response): Promise<void> {
    const input = req.body as RegisterInput;
    const result = await authService.register(input);
    sendCreated(res, result);
  },

  /**
   * POST /auth/refresh
   * Renueva los tokens usando un refresh token válido.
   */
  async refresh(req: Request, res: Response): Promise<void> {
    const input = req.body as RefreshInput;
    const result = await authService.refresh(input);
    sendSuccess(res, result);
  },

  /**
   * GET /auth/profile
   * Retorna el perfil del usuario autenticado.
   * Requiere: protect middleware.
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const result = await authService.getProfile(userId);
    sendSuccess(res, result);
  },

  /**
   * PUT /auth/profile
   * Actualiza el perfil (nombre/apellido) del usuario autenticado.
   * Requiere: protect middleware.
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const input = req.body as UpdateProfileInput;
    const result = await authService.updateProfile(userId, input);
    sendSuccess(res, result);
  },

  /**
   * POST /auth/change-password
   * Cambia la contraseña del usuario autenticado.
   * Requiere: protect middleware.
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const input = req.body as ChangePasswordInput;
    await authService.changePassword(userId, input);
    sendNoContent(res);
  },
};
