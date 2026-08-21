/**
 * Store de autenticación con Zustand.
 * Maneja estado de sesión, tokens y usuario autenticado.
 */
import { create } from 'zustand';
import type { AuthUser } from '@/types/auth.types';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  adAccessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string, adAccessToken?: string) => void;
  setUser: (user: AuthUser) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  adAccessToken: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user, accessToken, refreshToken, adAccessToken) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      if (adAccessToken) {
        localStorage.setItem('adAccessToken', adAccessToken);
      } else {
        localStorage.removeItem('adAccessToken');
      }
    }
    set({
      user,
      accessToken,
      refreshToken,
      adAccessToken: adAccessToken ?? null,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  setUser: (user) => {
    set({ user });
  },

  setLoading: (isLoading) => {
    set({ isLoading });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('adAccessToken');
    }
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      adAccessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  initialize: () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refreshToken');
      const adAccessToken = localStorage.getItem('adAccessToken');
      if (token && refreshToken) {
        set({ accessToken: token, refreshToken, adAccessToken, isLoading: true });
      } else {
        set({ isLoading: false });
      }
    } else {
      set({ isLoading: false });
    }
  },
}));
