/**
 * Tipos e interfaces del módulo de autenticación.
 */

import { UserRole } from '@prisma/client';

// ── JWT Payload ─────────────────────────────────────────────────
/**
 * Datos codificados dentro del access token JWT.
 */
export interface JwtPayload {
  sub: string;       // User ID
  email: string;
  role: UserRole;
  type: 'access';
}

/**
 * Datos codificados dentro del refresh token JWT.
 */
export interface JwtRefreshPayload {
  sub: string;       // User ID
  type: 'refresh';
}

// ── Respuesta de autenticación ──────────────────────────────────
/**
 * Datos del usuario retornados en respuestas de auth (sin passwordHash).
 */
export interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  sede: { id: string; name: string } | null;
}

/**
 * Respuesta de login/register/refresh con tokens + datos de usuario.
 */
export interface AuthTokenResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  /** Token AD-userAPI para consultar la API de formularios (admin). */
  adAccessToken?: string;
}

// ── Augmentación de Express Request ─────────────────────────────
/**
 * Extiende Express.Request para agregar el usuario autenticado.
 * Disponible después de pasar por el middleware `protect`.
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
