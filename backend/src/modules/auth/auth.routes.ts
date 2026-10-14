/**
 * Rutas del módulo de autenticación.
 *
 * Públicas:
 *   POST /auth/exchange
 *   POST /auth/register  → 403
 *   POST /auth/refresh
 *
 * Protegidas / semi:
 *   POST   /auth/logout   → Bearer (revoca sid local)
 *   GET    /auth/profile
 *   PUT    /auth/profile
 *   POST   /auth/change-password → 403
 */
import { Router } from 'express';
import { authController } from './auth.controller';
import { entraBrowserController } from './entra-browser.controller';
import { asyncHandler } from '../../shared/middlewares/async-handler.middleware';
import { validate } from '../../shared/middlewares/validate.middleware';
import { protect } from './auth.middleware';
import { handleEntraRevokeWebhook } from './entra-revoke.webhook';
import {
  exchangeSchema,
  registerSchema,
  refreshSchema,
  changePasswordSchema,
  updateProfileSchema,
} from './auth.validator';

export const authRoutes = Router();

/** El navegador solo llega aquí por la IP del backend. El clientId lo pone el servidor. */
authRoutes.post('/entra/start', asyncHandler(entraBrowserController.start));
authRoutes.get('/entra/callback', asyncHandler(entraBrowserController.callback));

authRoutes.post(
  '/exchange',
  validate(exchangeSchema, 'body'),
  asyncHandler(authController.exchange)
);

/** Webhook S2S desde ENTRA (HMAC). Sin JWT de usuario. */
authRoutes.post('/entra-revoke', asyncHandler(handleEntraRevokeWebhook));

authRoutes.post(
  '/register',
  validate(registerSchema, 'body'),
  asyncHandler(authController.register)
);

authRoutes.post(
  '/refresh',
  validate(refreshSchema, 'body'),
  asyncHandler(authController.refresh)
);

authRoutes.post('/logout', asyncHandler(authController.logout));

authRoutes.get('/profile', protect, asyncHandler(authController.getProfile));

authRoutes.put(
  '/profile',
  protect,
  validate(updateProfileSchema, 'body'),
  asyncHandler(authController.updateProfile)
);

authRoutes.post(
  '/change-password',
  protect,
  validate(changePasswordSchema, 'body'),
  asyncHandler(authController.changePassword)
);
