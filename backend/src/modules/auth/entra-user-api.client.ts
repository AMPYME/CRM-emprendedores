/**
 * Cliente hacia ENTRA-userAPI (login central).
 *
 * Contrato (AUTH_INTEGRATION.md):
 * - POST /api/auth/exchange — perfil + sessionRef (S2S)
 * - POST /api/auth/introspect — active sin renovar idle (S2S)
 * - GET  /api/auth/me / POST /api/auth/logout — solo navegador (cookie)
 */
import { logger } from '../../shared/logger/logger';

export interface EntraProfile {
  id: string;
  username: string;
  name: string;
  email: string;
  department: string;
  jobTitle: string;
  roles: string[];
  permissions: string[];
  sessionRef?: string;
  sessionAbsoluteExpiresAt?: string;
}

export type EntraExchangeOutcome =
  | { kind: 'success'; profile: EntraProfile }
  | { kind: 'invalid_code' }
  | { kind: 'unavailable' };

export type EntraIntrospectOutcome =
  | {
      kind: 'active';
      userId: string;
      absoluteExpiresAt?: string;
    }
  | { kind: 'inactive' }
  | { kind: 'unauthorized' }
  | { kind: 'unavailable' };

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

function readString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === 'string' ? value.trim() : '';
}

function readStrings(body: Record<string, unknown>, key: string): string[] {
  const value = body[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

export async function exchangeEntraCode(
  baseUrl: string,
  code: string,
  clientId: string,
  clientSecret: string
): Promise<EntraExchangeOutcome> {
  const url = joinUrl(baseUrl, '/api/auth/exchange');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ code, clientId, clientSecret }),
    });

    if (!res.ok) {
      logger.debug('Entra exchange rechazado', { status: res.status, url });
      if (res.status === 400 || res.status === 401) {
        return { kind: 'invalid_code' };
      }
      return { kind: 'unavailable' };
    }

    const data = (await res.json()) as Record<string, unknown>;
    const username = readString(data, 'username');
    if (!username) {
      logger.warn('Entra exchange: respuesta sin username', { url });
      return { kind: 'unavailable' };
    }

    return {
      kind: 'success',
      profile: {
        id: readString(data, 'id'),
        username,
        name: readString(data, 'name') || username,
        email: readString(data, 'email'),
        department: readString(data, 'department'),
        jobTitle: readString(data, 'jobTitle'),
        roles: readStrings(data, 'roles'),
        permissions: readStrings(data, 'permissions'),
        sessionRef: readString(data, 'sessionRef') || undefined,
        sessionAbsoluteExpiresAt: readString(data, 'sessionAbsoluteExpiresAt') || undefined,
      },
    };
  } catch (err) {
    logger.warn('Entra exchange: error de red o parseo', {
      url,
      message: err instanceof Error ? err.message : String(err),
    });
    return { kind: 'unavailable' };
  }
}

/**
 * POST /api/auth/introspect — no renueva idle en Redis.
 */
export async function introspectEntraSession(
  baseUrl: string,
  sessionRef: string,
  clientId: string,
  clientSecret: string
): Promise<EntraIntrospectOutcome> {
  const url = joinUrl(baseUrl, '/api/auth/introspect');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sessionRef, clientId, clientSecret }),
    });

    if (res.status === 401) return { kind: 'unauthorized' };
    if (res.status === 503 || res.status >= 500) return { kind: 'unavailable' };
    if (!res.ok) return { kind: 'unavailable' };

    const data = (await res.json()) as Record<string, unknown>;
    if (data.active === true) {
      return {
        kind: 'active',
        userId: readString(data, 'userId'),
        absoluteExpiresAt: readString(data, 'absoluteExpiresAt') || undefined,
      };
    }
    return { kind: 'inactive' };
  } catch (err) {
    logger.warn('Entra introspect: error de red', {
      url,
      message: err instanceof Error ? err.message : String(err),
    });
    return { kind: 'unavailable' };
  }
}
