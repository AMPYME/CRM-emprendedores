/**
 * Rutas del módulo de autenticación.
 *
 * Rutas públicas:
 *   POST /auth/login     → solo Active Directory
 *   POST /auth/register  → deshabilitado (403)
 *   POST /auth/refresh
 *
 * Rutas protegidas:
 *   GET    /auth/profile
 *   PUT    /auth/profile
 *   POST   /auth/change-password → deshabilitado (403; contraseña en AD)
 */
import { Router } from 'express';
import { authController } from './auth.controller';
import { asyncHandler } from '../../shared/middlewares/async-handler.middleware';
import { validate } from '../../shared/middlewares/validate.middleware';
import { protect } from './auth.middleware';
import {
  loginSchema,
  registerSchema,
  refreshSchema,
  changePasswordSchema,
  updateProfileSchema,
} from './auth.validator';

export const authRoutes = Router();

// ── Rutas públicas ──────────────────────────────────────────────

authRoutes.post(
  '/login',
  validate(loginSchema, 'body'),
  asyncHandler(authController.login)
);

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

// ── Rutas protegidas ────────────────────────────────────────────

authRoutes.get(
  '/profile',
  protect,
  asyncHandler(authController.getProfile)
);

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
