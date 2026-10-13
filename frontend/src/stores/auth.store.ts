/**
 * Store de autenticación con Zustand.
 * - JWT del CRM: autorización de APIs del propio CRM.
 * - Sesión ENTRA (cookie): fuente de verdad de autenticación del navegador.
 * csrfToken solo en memoria (no localStorage / sessionStorage).
 */
import { create } from 'zustand';
import type { AuthUser } from '@/types/auth.types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  csrfToken: string | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isLoading: boolean;

  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  setUser: (user: AuthUser) => void;
  setCsrfToken: (token: string | null) => void;
  setStatus: (status: AuthStatus) => void;
  setLoading: (loading: boolean) => void;
  /** Limpia JWT local + CSRF + usuario (sin llamar a ENTRA). */
  clearLocalSession: () => void;
  /** @deprecated Preferir clearLocalSession + logout central vía useAuth/header. */
  logout: () => void;
  initialize: () => void;
}

function clearTokenStorage(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('adAccessToken');
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  csrfToken: null,
  status: 'loading',
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user, accessToken, refreshToken) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.removeItem('adAccessToken');
    }
    set({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: true,
      status: 'authenticated',
      isLoading: false,
    });
  },

  setUser: (user) => {
    set({ user, isAuthenticated: true, status: 'authenticated' });
  },

  setCsrfToken: (csrfToken) => {
    set({ csrfToken });
  },

  setStatus: (status) => {
    set({
      status,
      isLoading: status === 'loading',
      isAuthenticated: status === 'authenticated',
    });
  },

  setLoading: (isLoading) => {
    set((state) => ({
      isLoading,
      status: isLoading ? 'loading' : state.status === 'loading' ? 'unauthenticated' : state.status,
    }));
  },

  clearLocalSession: () => {
    clearTokenStorage();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      csrfToken: null,
      isAuthenticated: false,
      isLoading: false,
      status: 'unauthenticated',
    });
  },

  logout: () => {
    clearTokenStorage();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      csrfToken: null,
      isAuthenticated: false,
      isLoading: false,
      status: 'unauthenticated',
    });
  },

  initialize: () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refreshToken');
      localStorage.removeItem('adAccessToken');
      if (token && refreshToken) {
        set({ accessToken: token, refreshToken, isLoading: true, status: 'loading' });
      } else {
        set({ isLoading: false, status: 'unauthenticated' });
      }
    } else {
      set({ isLoading: false, status: 'loading' });
    }
  },
}));
