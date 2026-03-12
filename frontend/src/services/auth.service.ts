/**
 * Servicio de autenticación.
 * Maneja login, registro, refresh de tokens y perfil.
 */
import { apiClient } from './api-client';
import type { ApiResponse } from '@/types/api.types';
import type { AuthTokenResponse, AuthUser, LoginInput, RegisterInput } from '@/types/auth.types';

export const authService = {
  async login(data: LoginInput): Promise<AuthTokenResponse> {
    const res = await apiClient.post<ApiResponse<AuthTokenResponse>>('/auth/login', data);
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
};
