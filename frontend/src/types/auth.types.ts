/**
 * Tipos para autenticación y usuarios.
 */

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'EMPREND_ADMIN' | 'EMPREND_OPERADOR' | 'EMPREND_VIEWER';

export interface AuthUser {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  sede: { id: string; name: string } | null;
  departamento: { id: string; name: string } | null;
}

export interface AuthTokenResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  adAccessToken?: string;
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
