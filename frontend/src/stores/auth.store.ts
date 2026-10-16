/**
 * Store de autenticación con Zustand.
 * - JWT del CRM: autorización de APIs del propio CRM (sesión local con sid).
 * - Sesión ENTRA (cookie): comprobación UX del navegador.
 * csrfToken solo en memoria.
 *
 * status `error` = sesión central no confirmada (indisponibilidad): no tratar como autenticado.
 */
import { create } from 'zustand';
import type { AuthUser } from '@/types/auth.types';
import { clearLogoutFlags, markAuthenticatedReady } from '@/lib/auth-session-control';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  csrfToken: string | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Aviso UX si el logout central no se pudo confirmar. */
  centralLogoutWarning: string | null;

  setAuth: (user: AuthUser, accessToken: string, refreshToken: string, adAccessToken?: string) => void;
  setUser: (user: AuthUser) => void;
  setCsrfToken: (token: string | null) => void;
  setStatus: (status: AuthStatus) => void;
  setLoading: (loading: boolean) => void;
  setCentralLogoutWarning: (msg: string | null) => void;
  clearLocalSession: () => void;
  /** @deprecated Preferir flujo de logout centralizado. */
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
  centralLogoutWarning: null,

  setAuth: (user, accessToken, refreshToken, adAccessToken) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      if (adAccessToken) localStorage.setItem('adAccessToken', adAccessToken);
      else localStorage.removeItem('adAccessToken');
    }
    clearLogoutFlags();
    markAuthenticatedReady();
    set({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: true,
      status: 'authenticated',
      isLoading: false,
      centralLogoutWarning: null,
    });
  },

  setUser: (user) => {
    clearLogoutFlags();
    markAuthenticatedReady();
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

  setCentralLogoutWarning: (centralLogoutWarning) => {
    set({ centralLogoutWarning });
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
