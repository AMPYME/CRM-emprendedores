/**
 * Tipos para autenticación y usuarios.
 */

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'EMPREND_ADMIN' | 'EMPREND_OPERADOR' | 'EMPREND_VIEWER';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuthTokenResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
}
