/**
 * Cliente HTTP hacia la API interna de usuarios (AD-user-api).
 * Solo se usa desde el backend (sin CORS en el navegador).
 */
import { logger } from '../../shared/logger/logger';
import { extractRoleNamesFromMeUser, normalizeMeUserPayload } from './ad-auth.mapper';

export interface AdLoginResult {
  accessToken: string;
  refreshToken?: string;
}

/** Resultado de POST /api/auth/login contra AD-userAPI. */
export type AdLoginOutcome =
  | { kind: 'success'; tokens: AdLoginResult }
  | { kind: 'invalid_credentials' }
  | { kind: 'unavailable' };

/** Perfil típico devuelto por GET /api/auth/me (campos pueden variar según versión). */
export interface AdMeProfile {
  email?: string;
  userPrincipalName?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  givenName?: string;
  familyName?: string;
  surname?: string;
  displayName?: string;
  /** Nombres de rol desde la API (campo `user.roles`, normalizados a MAYÚSCULAS). */
  roleNames?: string[];
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

function readToken(body: Record<string, unknown>, key: string): string | undefined {
  const v = body[key];
  return typeof v === 'string' ? v : undefined;
}

/**
 * POST /api/auth/login — credenciales de Active Directory.
 * - `invalid_credentials`: credenciales rechazadas (p. ej. 401/403).
 * - `unavailable`: red / error de parseo / respuesta inválida.
 */
export async function adLogin(
  baseUrl: string,
  username: string,
  password: string
): Promise<AdLoginOutcome> {
  const url = joinUrl(baseUrl, '/api/auth/login');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      logger.debug('AD API login rechazado', { status: res.status, url });
      if (res.status === 401 || res.status === 403) {
        return { kind: 'invalid_credentials' };
      }
      return { kind: 'unavailable' };
    }

    const data = (await res.json()) as Record<string, unknown>;
    const accessToken =
      readToken(data, 'accessToken') ?? readToken(data, 'access_token');
    if (!accessToken) {
      logger.warn('AD API login: respuesta sin accessToken', { url });
      return { kind: 'unavailable' };
    }

    const refreshToken =
      readToken(data, 'refreshToken') ?? readToken(data, 'refresh_token');

    return { kind: 'success', tokens: { accessToken, refreshToken } };
  } catch (err) {
    logger.warn('AD API login: error de red o parseo', {
      url,
      message: err instanceof Error ? err.message : String(err),
    });
    return { kind: 'unavailable' };
  }
}

/**
 * GET /api/auth/me — requiere Authorization: Bearer.
 */
export async function adGetMe(baseUrl: string, accessToken: string): Promise<AdMeProfile | null> {
  const url = joinUrl(baseUrl, '/api/auth/me');
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      logger.warn('AD API /me no OK', { status: res.status, url });
      return null;
    }

    const data = (await res.json()) as Record<string, unknown>;
    const user = normalizeMeUserPayload(data);
    const roleNames = extractRoleNamesFromMeUser(user);

    return {
      email: typeof user.email === 'string' ? user.email : undefined,
      userPrincipalName:
        typeof user.userPrincipalName === 'string' ? user.userPrincipalName : undefined,
      username: typeof user.username === 'string' ? user.username : undefined,
      firstName: typeof user.firstName === 'string' ? user.firstName : undefined,
      lastName: typeof user.lastName === 'string' ? user.lastName : undefined,
      givenName: typeof user.givenName === 'string' ? user.givenName : undefined,
      familyName: typeof user.familyName === 'string' ? user.familyName : undefined,
      surname: typeof user.surname === 'string' ? user.surname : undefined,
      displayName: typeof user.displayName === 'string' ? user.displayName : undefined,
      roleNames,
    };
  } catch (err) {
    logger.warn('AD API /me: error de red o parseo', {
      url,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
