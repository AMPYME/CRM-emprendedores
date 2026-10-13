/**
 * Sesión centralizada ENTRA-userAPI (cookie HttpOnly).
 *
 * GET /api/auth/me renueva la inactividad en Redis (LookupSession → advanceSession).
 * No usar polling frecuente: mantendría viva la sesión solo por comprobaciones.
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
   * Si falta CSRF o responde 403, intenta un /me y un único reintento.
   */
  async logout(
    csrfToken: string | null,
    signal?: AbortSignal
  ): Promise<{ ok: boolean; status: number; centralUnconfirmed?: boolean }> {
    const attempt = async (csrf: string | null) => {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (csrf) headers['X-CSRF-Token'] = csrf;

      const res = await fetch(joinUrl('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
        headers,
        signal,
      });
      return res;
    };

    try {
      let res = await attempt(csrfToken);
      if (res.status === 204 || res.ok) {
        return { ok: true, status: res.status };
      }

      // CSRF ausente/inválido u otro error: recuperar token y reintentar una vez.
      if (res.status === 403 || res.status === 401 || !csrfToken) {
        const me = await this.me(signal);
        if (me.kind === 'ok' && me.data.csrfToken) {
          res = await attempt(me.data.csrfToken);
          if (res.status === 204 || res.ok) {
            return { ok: true, status: res.status };
          }
        }
        if (me.kind === 'unauthorized') {
          // Ya no hay sesión central.
          return { ok: true, status: 204 };
        }
      }

      return { ok: false, status: res.status, centralUnconfirmed: true };
    } catch {
      return { ok: false, status: 0, centralUnconfirmed: true };
    }
  },
};
