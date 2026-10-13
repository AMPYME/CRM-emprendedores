/**
 * Cliente hacia ENTRA-userAPI (login central).
 *
 * Contrato documentado hoy: POST /api/auth/exchange (secreto de aplicación).
 * El frontend valida la cookie central con GET /api/auth/me (credentials).
 *
 * Las APIs del CRM siguen autorizando con JWT propio emitido tras el exchange.
 * No hay endpoint documentado para que el backend del CRM valide la sesión Redis
 * de ENTRA reenviando la cookie del navegador; no se inventa acceso directo a Redis.
 * Si ENTRA publica un contrato server-to-server de validación de sesión, integrar aquí.
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
}

export type EntraExchangeOutcome =
  | { kind: 'success'; profile: EntraProfile }
  | { kind: 'invalid_code' }
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

/**
 * POST /api/auth/exchange. El código se consume al leerlo.
 */
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
