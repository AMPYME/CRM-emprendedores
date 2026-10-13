/**
 * Cliente HTTP base para comunicación con el backend del CRM.
 * Centraliza configuración de Axios, interceptores y manejo de tokens JWT.
 *
 * Ante 401: se consulta ENTRA /api/auth/me.
 * - Si la sesión central murió → cierre local + login.
 * - Si la sesión central sigue viva → se intenta refresh JWT del CRM (no se cierra ENTRA).
 */
import axios, { type AxiosError } from 'axios';
import { publicApiBaseUrl } from '@/lib/public-urls';
import { entraSessionService } from '@/services/entra-session.service';
import { clearPrivateQueryCache } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth.store';

function apiBaseUrl(): string {
  return publicApiBaseUrl();
}

export const apiClient = axios.create({
  // En navegador el interceptor fuerza same-origin /backend-api (sin CORS).
  baseURL: '/backend-api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  config.baseURL = apiBaseUrl();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

function forceLocalLogout(): void {
  if (typeof window === 'undefined') return;
  useAuthStore.getState().clearLocalSession();
  clearPrivateQueryCache();
  if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
}

async function centralSessionAlive(): Promise<boolean | null> {
  const result = await entraSessionService.me();
  if (result.kind === 'unauthorized' || result.kind === 'forbidden') return false;
  if (result.kind === 'ok') {
    useAuthStore.getState().setCsrfToken(result.data.csrfToken ?? null);
    return true;
  }
  return null;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest?._retry) {
      if (
        originalRequest?.url?.includes('/auth/exchange') ||
        originalRequest?.url?.includes('/auth/refresh')
      ) {
        return Promise.reject(error);
      }

      // Si la sesión central murió, cerrar CRM. Si sigue viva, el 401 es del JWT del CRM.
      const central = await centralSessionAlive();
      if (central === false) {
        forceLocalLogout();
        return Promise.reject(error);
      }

      const refreshToken =
        typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;

      if (!refreshToken) {
        forceLocalLogout();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return apiClient(originalRequest);
            }
          })
          .catch((err) => Promise.reject(err));
      }

      if (originalRequest) {
        originalRequest._retry = true;
      }
      isRefreshing = true;

      try {
        const res = await axios.post(`${apiBaseUrl()}/auth/refresh`, { refreshToken });
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = res.data.data;

        localStorage.setItem('token', newAccessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        processQueue(null, newAccessToken);

        if (originalRequest) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        // JWT del CRM irrecuperable: limpiar tokens locales.
        // Si central === true, no implica revocar cookie ENTRA (solo UX de CRM).
        forceLocalLogout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/** Extrae mensaje de error del backend o de un Error lanzado en el cliente */
export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error?.message || error.message || 'Error de conexión';
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Error inesperado';
}

/** Detalles adicionales del error (p. ej. existingEntityId en duplicados). */
export function getApiErrorDetails(error: unknown): Record<string, unknown> | undefined {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error?.details as Record<string, unknown> | undefined;
  }
  return undefined;
}
