/**
 * Servicio de autenticación del CRM (JWT tras exchange con ENTRA).
 * La sesión centralizada (cookie) se valida con entra-session.service.
 */
import { apiClient } from './api-client';
import type { ApiResponse } from '@/types/api.types';
import type { AuthTokenResponse, AuthUser, RegisterInput } from '@/types/auth.types';
import { entraSessionService } from './entra-session.service';
import { useAuthStore } from '@/stores/auth.store';
import { clearPrivateQueryCache } from '@/lib/query-client';

export const authService = {
  async exchange(code: string): Promise<AuthTokenResponse> {
    const res = await apiClient.post<ApiResponse<AuthTokenResponse>>('/auth/exchange', { code });
    return res.data.data;
  },

  async register(data: RegisterInput): Promise<AuthTokenResponse> {
    const res = await apiClient.post<ApiResponse<AuthTokenResponse>>('/auth/register', data);
    return res.data.data;
  },

  async refresh(refreshToken: string): Promise<AuthTokenResponse> {
    const res = await apiClient.post<ApiResponse<AuthTokenResponse>>('/auth/refresh', { refreshToken });
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

  /** Cierra sesión central ENTRA + limpia JWT local. */
  async logoutCentral(): Promise<void> {
    const csrf = useAuthStore.getState().csrfToken;
    try {
      await entraSessionService.logout(csrf);
    } catch {
      /* continuar limpieza local */
    }
    useAuthStore.getState().clearLocalSession();
    clearPrivateQueryCache();
  },
};
