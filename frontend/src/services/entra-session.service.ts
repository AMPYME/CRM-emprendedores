/**
 * Sesión centralizada ENTRA-userAPI (cookie HttpOnly).
 * Fuente de verdad del estado de autenticación del navegador.
 *
 * Nota: GET /api/auth/me renueva la inactividad de la sesión en Redis
 * (LookupSession → advanceSession). No usar polling frecuente o se
 * mantendrá viva la sesión solo por comprobaciones automáticas.
 */
import { ENTRA_API_URL } from '@/lib/entra';

export type EntraMeUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  department?: string;
  jobTitle?: string;
  roles?: string[];
  permissions?: string[];
};

export type EntraMeResponse = {
  authenticated: boolean;
  user?: EntraMeUser;
  csrfToken?: string;
};

export type EntraMeResult =
  | { kind: 'ok'; data: EntraMeResponse }
  | { kind: 'unauthorized' }
  | { kind: 'forbidden' }
  | { kind: 'unavailable'; status?: number }
  | { kind: 'network' };

function joinUrl(path: string): string {
  return `${ENTRA_API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export const entraSessionService = {
  async me(signal?: AbortSignal): Promise<EntraMeResult> {
    try {
      const res = await fetch(joinUrl('/api/auth/me'), {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
        signal,
        cache: 'no-store',
      });

      if (res.status === 401) return { kind: 'unauthorized' };
      if (res.status === 403) return { kind: 'forbidden' };
      if (!res.ok) return { kind: 'unavailable', status: res.status };

      const data = (await res.json()) as EntraMeResponse;
      if (!data?.authenticated) return { kind: 'unauthorized' };
      return { kind: 'ok', data };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { kind: 'unavailable' };
      }
      return { kind: 'network' };
    }
  },

  /**
   * Cierra la sesión central. Espera 204.
   * Requiere X-CSRF-Token en POST (mismo valor que csrfToken de /me).
   */
  async logout(csrfToken: string | null, signal?: AbortSignal): Promise<{ ok: boolean; status: number }> {
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

      const res = await fetch(joinUrl('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
        headers,
        signal,
      });

      return { ok: res.status === 204 || res.ok, status: res.status };
    } catch {
      return { ok: false, status: 0 };
    }
  },
};
