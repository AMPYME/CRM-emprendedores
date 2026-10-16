/**
 * Tipos e interfaces del módulo de autenticación.
 */

import { UserRole } from '@prisma/client';

// ── JWT Payload ─────────────────────────────────────────────────
/**
 * Datos codificados dentro del access token JWT.
 * `role` es informativo; authorize usa el rol fresco de BD.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access';
  /** Identificador de sesión local revocable. */
  sid: string;
  iss?: string;
  aud?: string;
}

/**
 * Datos codificados dentro del refresh token JWT.
 */
export interface JwtRefreshPayload {
  sub: string;
  type: 'refresh';
  sid: string;
  /** Familia de refresh (rotación / detección de reutilización). */
  fid: string;
  iss?: string;
  aud?: string;
}

// ── Respuesta de autenticación ──────────────────────────────────
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

export interface AuthTokenResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  /** sid de la sesión local (útil para diagnóstico; no sustituye al JWT). */
  sessionId?: string;
  /** Expiración absoluta de la sesión (ISO). */
  absoluteExpiresAt?: string;
  /** Token de AD-userAPI. El navegador no lo usa para llamar a AD. */
  adAccessToken?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** sid de la sesión CRM validada en protect. */
      sessionId?: string;
    }
  }
}
