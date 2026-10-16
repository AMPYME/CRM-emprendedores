/**
 * Servicio de autenticación del CRM (JWT + sesión local sid).
 * La cookie ENTRA se valida en el navegador con entra-session.service.
 */
import { apiClient, rejectRefreshQueue } from './api-client';
import type { ApiResponse } from '@/types/api.types';
import type { AuthTokenResponse, AuthUser, LoginInput, RegisterInput } from '@/types/auth.types';
import { entraSessionService } from './entra-session.service';
import { useAuthStore } from '@/stores/auth.store';
import { clearPrivateQueryCache } from '@/lib/query-client';
import {
  beginLogout,
  closeAppWebSockets,
  isStaleEpoch,
} from '@/lib/auth-session-control';

export type LogoutResult = {
  localRevoked: boolean;
  centralOk: boolean;
  centralUnconfirmed: boolean;
};

export const authService = {
  async login(data: LoginInput): Promise<AuthTokenResponse> {
    const res = await apiClient.post<ApiResponse<AuthTokenResponse>>('/auth/login', data);
    return res.data.data;
  },

  async exchange(code: string): Promise<AuthTokenResponse> {
    const res = await apiClient.post<ApiResponse<AuthTokenResponse>>('/auth/exchange', { code });
    return res.data.data;
  },

  async register(data: RegisterInput): Promise<AuthTokenResponse> {
    const res = await apiClient.post<ApiResponse<AuthTokenResponse>>('/auth/register', data);
    return res.data.data;
  },

  async refresh(refreshToken: string): Promise<AuthTokenResponse> {
    const res = await apiClient.post<ApiResponse<AuthTokenResponse>>('/auth/refresh', {
      refreshToken,
    });
    return res.data.data;
  },

  async getProfile(): Promise<AuthUser> {
    const res = await apiClient.get<ApiResponse<AuthUser>>('/auth/profile');
    return res.data.data;
  },

  async updateProfile(data: { firstName?: string; lastName?: string }): Promise<AuthUser> {
    const res = await apiClient.put<ApiResponse<AuthUser>>('/auth/profile', data);
    return res.data.data;
  },

  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<void> {
    await apiClient.post('/auth/change-password', data);
  },

  /** Revoca sesión local CRM (sid). Ignora 401 si el token ya no vale. */
  async logoutLocal(): Promise<boolean> {
    try {
      await apiClient.post('/auth/logout');
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Logout completo: bloquea requests → CRM logout → ENTRA logout → limpia local.
   */
  async logoutAll(): Promise<LogoutResult> {
    const epoch = beginLogout();
    rejectRefreshQueue();
    closeAppWebSockets();

    const accessToken =
      typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    let localRevoked = false;
    if (accessToken) {
      localRevoked = await this.logoutLocal();
    }

    if (isStaleEpoch(epoch)) {
      /* otra pestaña avanzó la época */
    }

    const csrf = useAuthStore.getState().csrfToken;
    const central = await entraSessionService.logout(csrf);
    const centralOk = central.ok;
    const centralUnconfirmed = Boolean(central.centralUnconfirmed);

    useAuthStore.getState().clearLocalSession();
    clearPrivateQueryCache();
    if (centralUnconfirmed) {
      useAuthStore
        .getState()
        .setCentralLogoutWarning(
          'Se cerró la sesión local del CRM, pero el cierre en el servicio de identidad no pudo confirmarse.'
        );
    }

    return { localRevoked, centralOk, centralUnconfirmed };
  },

  /** @deprecated usar logoutAll */
  async logoutCentral(): Promise<void> {
    await this.logoutAll();
  },
};
