/**
 * Mapea respuestas de la API interna de usuarios a datos del modelo local (email, nombres, roles).
 *
 * GET /api/auth/me devuelve usuario normalizado desde BD, p. ej.:
 * `{ "user": { "email", "roles": ["USER","ADMIN"], "permissions": ["users.read", ...] } }`
 * — los nombres de rol vienen en `roles` (campo `role.name` agregado en el API server).
 * `permissions` no son roles: no se usan para comprobar acceso por rol de aplicación.
 */
import type { AdMeProfile } from './ad-user-api.client';

/**
 * Obtiene el objeto usuario desde el JSON de /me (prioriza `user`, luego `data`).
 */
export function normalizeMeUserPayload(root: Record<string, unknown>): Record<string, unknown> {
  const u = root.user;
  if (typeof u === 'object' && u !== null) {
    return u as Record<string, unknown>;
  }
  const d = root.data;
  if (typeof d === 'object' && d !== null) {
    return d as Record<string, unknown>;
  }
  return root;
}

/**
 * Extrae nombres de rol normalizados a MAYÚSCULAS (como vienen en la API: USER, ADMIN, BD_EMPREND…).
 * Fuente principal: `roles` (string[]). No mezcla `permissions` con roles.
 */
export function extractRoleNamesFromMeUser(user: Record<string, unknown>): string[] {
  const out = new Set<string>();
  const add = (v: unknown): void => {
    if (typeof v === 'string' && v.trim()) {
      out.add(v.trim().toUpperCase());
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === 'string' && item.trim()) {
          out.add(item.trim().toUpperCase());
        } else if (item && typeof item === 'object') {
          const o = item as Record<string, unknown>;
          const name = o.name ?? o.slug ?? o.code ?? o.role;
          if (typeof name === 'string' && name.trim()) {
            out.add(name.trim().toUpperCase());
          }
        }
      }
    }
  };

  add(user.roles);
  add(user.roleSlugs);
  add(user.role);

  return [...out];
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

export function resolveEmailForLocalUser(
  profile: AdMeProfile,
  loginIdentifier: string,
  adEmailDomain?: string
): string | null {
  const tryEmail = (s: string | undefined): string | null => {
    if (!s) return null;
    const e = s.trim().toLowerCase();
    return e.includes('@') ? e : null;
  };

  const fromProfile =
    tryEmail(profile.email) ??
    tryEmail(profile.userPrincipalName) ??
    null;
  if (fromProfile) return fromProfile;

  const login = loginIdentifier.trim().toLowerCase();
  if (login.includes('@')) return login;

  if (adEmailDomain) {
    const domain = adEmailDomain.replace(/^@/, '').trim();
    if (domain) return `${login}@${domain}`;
  }

  return tryEmail(profile.userPrincipalName);
}

export function namesFromAdProfile(profile: AdMeProfile): { firstName: string; lastName: string } {
  const fn =
    profile.firstName ||
    profile.givenName ||
    (profile.displayName ? profile.displayName.trim().split(/\s+/)[0] : undefined);
  const ln =
    profile.lastName ||
    profile.familyName ||
    profile.surname ||
    (profile.displayName
      ? profile.displayName.trim().split(/\s+/).slice(1).join(' ')
      : undefined);

  if (fn || ln) {
    return {
      firstName: fn || 'Usuario',
      lastName: ln || '-',
    };
  }

  return { firstName: 'Usuario', lastName: 'AD' };
}
