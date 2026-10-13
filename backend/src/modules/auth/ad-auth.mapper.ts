/**
 * Mapea el perfil devuelto por POST /api/auth/exchange al usuario local del CRM.
 * Los permisos de Entra no se usan como roles de aplicación.
 *
 * Política: ENTRA gobierna el rol en cada exchange (auth.service.apply mapped role).
 * No se conservan privilegios administrativos locales si ENTRA mapea a operador/viewer.
 */
import type { UserRole } from '@prisma/client';

export interface DirectoryProfile {
  email?: string;
  username?: string;
  name?: string;
}

/**
 * Comprueba si el usuario tiene al menos uno de los nombres de rol requeridos (comparación en MAYÚSCULAS).
 */
export function hasAnyRequiredAdRole(
  userRoleNames: string[],
  requiredNames: readonly string[]
): boolean {
  if (requiredNames.length === 0) return true;
  const set = new Set(userRoleNames.map((r) => r.toUpperCase()));
  return requiredNames.some((r) => set.has(r.toUpperCase()));
}

/** Acceso total al CRM (incluye importaciones y auditoría). */
export const FULL_ACCESS_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'EMPREND_ADMIN'];

/** Operadores de campo/CRM sin importaciones ni auditoría. */
export const OPERADOR_ROLES: UserRole[] = ['EMPREND_OPERADOR'];

export type CrmMappedRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'EMPREND_ADMIN'
  | 'EMPREND_OPERADOR'
  | 'EMPREND_VIEWER';

/**
 * Mapea roles de Entra al rol CRM local.
 * Prioridad: SUPER_ADMIN > EMPREND_ADMIN > ADMIN > EMPREND_VIEWER > EMPREND_OPERADOR.
 * BD_EMPREND no se mapea (sin acceso al CRM).
 */
export function mapAdRolesToCrmRole(adRoleNames: string[]): CrmMappedRole {
  const roles = new Set(adRoleNames.map((r) => r.trim().toUpperCase()));
  if (roles.has('SUPER_ADMIN') || roles.has('SUPERADMIN')) {
    return 'SUPER_ADMIN';
  }
  if (roles.has('EMPREND_ADMIN')) {
    return 'EMPREND_ADMIN';
  }
  if (roles.has('ADMIN')) {
    return 'ADMIN';
  }
  if (roles.has('EMPREND_VIEWER')) {
    return 'EMPREND_VIEWER';
  }
  if (roles.has('EMPREND_OPERADOR')) {
    return 'EMPREND_OPERADOR';
  }
  // Fallback solo si el gate de AD_REQUIRED_APP_ROLES ya validó otro rol permitido.
  return 'EMPREND_OPERADOR';
}

export function isFullAccessRole(role: string): boolean {
  return (FULL_ACCESS_ROLES as string[]).includes(role);
}

export function canViewAudit(role: string): boolean {
  return isFullAccessRole(role);
}

export function canAccessImports(role: string): boolean {
  return isFullAccessRole(role);
}

/** Roles CRM de solo lectura en dashboard/personas/empresas. */
export function isReadOnlyCrmRole(role: string): boolean {
  return role === 'EMPREND_VIEWER';
}

export function isOperadorCrmRole(role: string): boolean {
  return role === 'EMPREND_OPERADOR';
}

export function resolveEmailForLocalUser(profile: DirectoryProfile): string | null {
  const email = profile.email?.trim().toLowerCase();
  if (!email || !email.includes('@')) return null;
  return email;
}

/** Nombre de usuario de acceso. No guarda el correo. */
export function resolveUsername(profile: DirectoryProfile): string {
  const username = profile.username?.trim();
  if (username && !username.includes('@')) return username;
  const local = profile.email?.split('@')[0]?.trim();
  return local || username || 'usuario';
}

export function namesFromDirectoryProfile(profile: DirectoryProfile): { firstName: string; lastName: string } {
  const parts = (profile.name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Usuario', lastName: '-' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '-' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
