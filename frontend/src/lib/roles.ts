import type { UserRole } from '@/types/auth.types';

const FULL_ACCESS: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'EMPREND_ADMIN'];
const VIEWER_NAV = new Set(['home', 'persons', 'companies']);
const OPERADOR_BLOCKED_NAV = new Set(['imports', 'audit']);

export function isFullAccessRole(role: UserRole | undefined | null): boolean {
  return !!role && FULL_ACCESS.includes(role);
}

/** Roles con acceso a la vista de auditoría e importaciones. */
export function canViewAudit(role: UserRole | undefined | null): boolean {
  return isFullAccessRole(role);
}

export function canAccessImports(role: UserRole | undefined | null): boolean {
  return isFullAccessRole(role);
}

/** Roles de solo lectura en dashboard/personas/empresas. */
export function isReadOnlyRole(role: UserRole | undefined | null): boolean {
  return role === 'EMPREND_VIEWER';
}

export function isOperadorRole(role: UserRole | undefined | null): boolean {
  return role === 'EMPREND_OPERADOR';
}

/**
 * Navegación lateral por rol:
 * - ADMIN / SUPER_ADMIN / EMPREND_ADMIN → todo
 * - EMPREND_OPERADOR → todo excepto Importaciones y Auditoría
 * - EMPREND_VIEWER → solo Dashboard, Personas, Empresas
 */
export function canAccessNav(
  role: UserRole | undefined | null,
  navId: string
): boolean {
  if (!role) return false;
  if (isFullAccessRole(role)) return true;
  if (isReadOnlyRole(role)) return VIEWER_NAV.has(navId);
  if (isOperadorRole(role)) return !OPERADOR_BLOCKED_NAV.has(navId);
  return false;
}

/** Pathname del dashboard → ¿permitido para el rol? */
export function canAccessPath(
  role: UserRole | undefined | null,
  pathname: string
): boolean {
  if (!role) return false;
  if (isFullAccessRole(role)) return true;

  const path = pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname;

  if (isReadOnlyRole(role)) {
    if (path === '/dashboard') return true;
    if (path.startsWith('/dashboard/persons')) return true;
    if (path.startsWith('/dashboard/companies')) return true;
    if (path === '/settings') return true;
    return false;
  }

  if (isOperadorRole(role)) {
    if (path.startsWith('/dashboard/imports')) return false;
    if (path.startsWith('/dashboard/audit')) return false;
    return true;
  }

  return false;
}

/** Etiqueta legible del rol en la UI. */
export function roleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Administrador',
    EMPREND_ADMIN: 'Admin Emprendedores',
    EMPREND_OPERADOR: 'Operador Emprendedores',
    EMPREND_VIEWER: 'Consulta Emprendedores',
  };
  return labels[role] ?? role;
}
