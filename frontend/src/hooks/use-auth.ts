'use client';

/**
 * Hook de autenticación.
 * ENTRA /api/auth/me es la comprobación UX del navegador.
 * Indisponibilidad ≠ autenticado: status `error` y bloqueo de rutas/API.
 * GET /me renueva idle en Redis: sin polling periódico agresivo.
 */
import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';
import { entraSessionService } from '@/services/entra-session.service';
import { clearPrivateQueryCache } from '@/lib/query-client';
import {
  beginLogout,
  closeAppWebSockets,
  getAuthEpoch,
  isStaleEpoch,
  onAuthBroadcast,
  markAuthenticatedReady,
} from '@/lib/auth-session-control';
import { rejectRefreshQueue } from '@/services/api-client';

let checkSessionInFlight: Promise<'authenticated' | 'unauthenticated' | 'error'> | null = null;
let lastSuccessfulCheckAt = 0;
/** Cooldown largo: /me renueva idle; evitar mantener la sesión artificialmente. */
const RECHECK_COOLDOWN_MS = 60_000;

function goToLogin(): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/login') return;
  window.location.replace('/login');
}

export function useAuth({ requireAuth = true }: { requireAuth?: boolean } = {}) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const {
    user,
    isAuthenticated,
    isLoading,
    status,
    csrfToken,
    centralLogoutWarning,
    setAuth,
    setUser,
    setCsrfToken,
    setStatus,
    setLoading,
    clearLocalSession,
    initialize,
  } = useAuthStore();

  const abortRef = useRef<AbortController | null>(null);

  const invalidateLocal = useCallback(() => {
    beginLogout();
    rejectRefreshQueue();
    closeAppWebSockets();
    abortRef.current?.abort();
    abortRef.current = null;
    clearLocalSession();
    clearPrivateQueryCache();
    queryClient.clear();
  }, [clearLocalSession, queryClient]);

  const checkSession = useCallback(async (opts?: {
    force?: boolean;
  }): Promise<'authenticated' | 'unauthenticated' | 'error'> => {
    if (checkSessionInFlight) return checkSessionInFlight;

    const force = opts?.force === true;
    if (
      !force &&
      useAuthStore.getState().status === 'authenticated' &&
      Date.now() - lastSuccessfulCheckAt < RECHECK_COOLDOWN_MS
    ) {
      return 'authenticated';
    }

    const epoch = getAuthEpoch();

    checkSessionInFlight = (async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const refreshToken =
        typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;

      if (!token || !refreshToken) {
        invalidateLocal();
        return 'unauthenticated';
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const central = await entraSessionService.me(controller.signal);
      if (controller.signal.aborted || isStaleEpoch(epoch)) {
        return useAuthStore.getState().status === 'authenticated'
          ? 'authenticated'
          : 'unauthenticated';
      }

      if (central.kind === 'unauthorized') {
        invalidateLocal();
        return 'unauthenticated';
      }

      if (central.kind === 'forbidden') {
        // Permisos ENTRA insuficientes: no mantener CRM autenticado.
        invalidateLocal();
        return 'unauthenticated';
      }

      if (central.kind === 'network' || central.kind === 'unavailable') {
        setStatus('error');
        setLoading(false);
        return 'error';
      }

      if (central.kind === 'ok') {
        setCsrfToken(central.data.csrfToken ?? null);
      }

      try {
        const profile = await authService.getProfile();
        if (isStaleEpoch(epoch)) return 'unauthenticated';
        setUser(profile);
        setLoading(false);
        markAuthenticatedReady();
        lastSuccessfulCheckAt = Date.now();
        return 'authenticated';
      } catch {
        // Refresh solo si la sesión central está confirmada (ya lo está aquí).
        try {
          const result = await authService.refresh(refreshToken);
          if (isStaleEpoch(epoch)) return 'unauthenticated';
          const profile = result.user ?? (await authService.getProfile());
          if (isStaleEpoch(epoch)) return 'unauthenticated';
          setAuth(profile, result.accessToken, result.refreshToken);
          lastSuccessfulCheckAt = Date.now();
          return 'authenticated';
        } catch {
          invalidateLocal();
          return 'unauthenticated';
        }
      }
    })().finally(() => {
      checkSessionInFlight = null;
    });

    return checkSessionInFlight;
  }, [invalidateLocal, setAuth, setCsrfToken, setLoading, setStatus, setUser]);

  const logout = useCallback(async () => {
    abortRef.current?.abort();
    checkSessionInFlight = null;
    await authService.logoutAll();
    queryClient.clear();
    goToLogin();
  }, [queryClient]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      initialize();
      const outcome = await checkSession({ force: true });
      if (cancelled) return;

      if (outcome === 'unauthenticated' && requireAuth) {
        goToLogin();
        return;
      }
      if (outcome === 'error' && requireAuth) {
        setLoading(false);
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincronización entre pestañas.
  useEffect(() => {
    return onAuthBroadcast((ev) => {
      if (ev.type === 'logout') {
        clearLocalSession();
        clearPrivateQueryCache();
        queryClient.clear();
        goToLogin();
      }
    });
  }, [clearLocalSession, queryClient]);

  useEffect(() => {
    if (!requireAuth) return;

    let debounce: ReturnType<typeof setTimeout> | null = null;

    const revalidate = () => {
      if (document.visibilityState === 'hidden') return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        void checkSession().then((outcome) => {
          if (outcome === 'unauthenticated') goToLogin();
        });
      }, 400);
    };

    document.addEventListener('visibilitychange', revalidate);
    window.addEventListener('focus', revalidate);
    return () => {
      if (debounce) clearTimeout(debounce);
      document.removeEventListener('visibilitychange', revalidate);
      window.removeEventListener('focus', revalidate);
    };
  }, [checkSession, requireAuth]);

  useEffect(() => {
    if (!requireAuth || !pathname) return;
    if (status === 'loading' || status === 'error') return;
    void checkSession().then((outcome) => {
      if (outcome === 'unauthenticated') goToLogin();
    });
  }, [pathname, requireAuth, checkSession, status]);

  return {
    user,
    isAuthenticated,
    isLoading,
    status,
    csrfToken,
    centralLogoutWarning,
    checkSession,
    logout,
  };
}
