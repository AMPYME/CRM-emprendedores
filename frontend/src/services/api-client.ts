/**
 * Cliente HTTP del CRM.
 *
 * Ante 401 renueva el JWT del CRM. AD y Entra se confirman en el backend.
 */
import axios, { type AxiosError } from 'axios';
import { publicApiBaseUrl } from '@/lib/public-urls';
import { clearPrivateQueryCache } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth.store';
import {
  areProtectedRequestsBlocked,
  beginLogout,
  closeAppWebSockets,
  getAuthEpoch,
  isAuthLoggingOut,
  isStaleEpoch,
} from '@/lib/auth-session-control';

function apiBaseUrl(): string {
  return publicApiBaseUrl();
}

export const apiClient = axios.create({
  baseURL: '/backend-api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
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

export function rejectRefreshQueue(reason: unknown = new Error('Sesión cerrada')): void {
  processQueue(reason, null);
  isRefreshing = false;
}

function forceLocalLogout(): void {
  if (typeof window === 'undefined') return;
  beginLogout();
  rejectRefreshQueue();
  closeAppWebSockets();
  useAuthStore.getState().clearLocalSession();
  clearPrivateQueryCache();
  if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
}

apiClient.interceptors.request.use((config) => {
  config.baseURL = apiBaseUrl();

  const url = config.url || '';
  const isAuthBootstrap =
    url.includes('/auth/login') ||
    url.includes('/auth/exchange') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout');

  if (!isAuthBootstrap && (areProtectedRequestsBlocked() || isAuthLoggingOut())) {
    return Promise.reject(new axios.Cancel('Solicitud bloqueada: sesión no confirmada o cerrando'));
  }

  if (!isAuthBootstrap && useAuthStore.getState().status === 'error') {
    return Promise.reject(new axios.Cancel('Sesión central no confirmada'));
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest?._retry) {
      if (
        originalRequest?.url?.includes('/auth/login') ||
        originalRequest?.url?.includes('/auth/exchange') ||
        originalRequest?.url?.includes('/auth/refresh') ||
        originalRequest?.url?.includes('/auth/logout')
      ) {
        return Promise.reject(error);
      }

      if (isAuthLoggingOut() || areProtectedRequestsBlocked()) {
        return Promise.reject(error);
      }

      const epochAtStart = getAuthEpoch();

      if (isStaleEpoch(epochAtStart) || isAuthLoggingOut()) {
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
            if (isStaleEpoch(epochAtStart) || isAuthLoggingOut()) {
              return Promise.reject(new Error('Sesión cerrada'));
            }
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
        if (isStaleEpoch(epochAtStart) || isAuthLoggingOut()) {
          processQueue(new Error('Sesión cerrada'), null);
          return Promise.reject(error);
        }

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = res.data.data;
        localStorage.setItem('token', newAccessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        useAuthStore.setState({
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        });

        processQueue(null, newAccessToken);

        if (originalRequest) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        forceLocalLogout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error?.message || error.message || 'Error de conexión';
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Error inesperado';
}

export function getApiErrorDetails(error: unknown): Record<string, unknown> | undefined {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error?.details as Record<string, unknown> | undefined;
  }
  return undefined;
}
