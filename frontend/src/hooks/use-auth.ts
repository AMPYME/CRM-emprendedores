'use client';

/**
 * Hook de autenticación.
 * Valida JWT del CRM y la sesión centralizada ENTRA (/api/auth/me).
 * ENTRA es la fuente de verdad: si la cookie central caduca o se revoca, se cierra el CRM.
 *
 * GET /api/auth/me renueva la inactividad en Redis; por eso no hay polling periódico
 * agresivo (p. ej. cada 60s). Se valida al iniciar, al volver a la pestaña y ante 401.
 */
import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';
import { entraSessionService } from '@/services/entra-session.service';
import { clearPrivateQueryCache } from '@/lib/query-client';

let checkSessionInFlight: Promise<'authenticated' | 'unauthenticated' | 'error'> | null = null;
/** Evita revalidaciones en ráfaga (cada /me renueva idle en Redis). */
let lastSuccessfulCheckAt = 0;
const RECHECK_COOLDOWN_MS = 15_000;

function goToLogin(): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/login') return;
  window.location.replace('/login');
}

export function useAuth({ requireAuth = true }: { requireAuth?: boolean } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const {
    user,
    isAuthenticated,
    isLoading,
    status,
    csrfToken,
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
      if (controller.signal.aborted) return useAuthStore.getState().status === 'authenticated'
        ? 'authenticated'
        : 'unauthenticated';

      if (central.kind === 'unauthorized' || central.kind === 'forbidden') {
        invalidateLocal();
        return 'unauthenticated';
      }

      if (central.kind === 'network' || central.kind === 'unavailable') {
        // Fallo seguro solo si aún no hay usuario confirmado.
        if (!useAuthStore.getState().user) {
          setStatus('error');
          setLoading(false);
          return 'error';
        }
        // Recheck en segundo plano: no cerrar sesión por un fallo temporal.
        return 'authenticated';
      }

      if (central.kind === 'ok') {
        setCsrfToken(central.data.csrfToken ?? null);
      }

      try {
        if (useAuthStore.getState().user) {
          setStatus('authenticated');
          setLoading(false);
          lastSuccessfulCheckAt = Date.now();
          return 'authenticated';
        }
        const profile = await authService.getProfile();
        setUser(profile);
        setLoading(false);
        lastSuccessfulCheckAt = Date.now();
        return 'authenticated';
      } catch {
        try {
          const result = await authService.refresh(refreshToken);
          const profile = result.user ?? (await authService.getProfile());
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
    const token = useAuthStore.getState().csrfToken;
    abortRef.current?.abort();
    checkSessionInFlight = null;
    try {
      await entraSessionService.logout(token);
    } catch {
      /* la limpieza local sigue igual */
    }
    invalidateLocal();
    goToLogin();
  }, [invalidateLocal]);

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
        // Bloquear rutas protegidas sin confirmar sesión.
        setLoading(false);
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al volver a la pestaña / foco: revalidar sin solapar.
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
      }, 300);
    };

    document.addEventListener('visibilitychange', revalidate);
    window.addEventListener('focus', revalidate);
    return () => {
      if (debounce) clearTimeout(debounce);
      document.removeEventListener('visibilitychange', revalidate);
      window.removeEventListener('focus', revalidate);
    };
  }, [checkSession, requireAuth]);

  // Cambio de ruta protegida: reutilizar check en vuelo si existe.
  useEffect(() => {
    if (!requireAuth || !pathname) return;
    if (status === 'loading') return;
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
    checkSession,
    logout,
  };
}

/** Usado por el interceptor HTTP ante 401 del CRM. */
export async function handleCrmUnauthorized(): Promise<'central-dead' | 'central-alive' | 'unknown'> {
  const central = await entraSessionService.me();
  if (central.kind === 'unauthorized' || central.kind === 'forbidden') {
    useAuthStore.getState().clearLocalSession();
    clearPrivateQueryCache();
    goToLogin();
    return 'central-dead';
  }
  if (central.kind === 'ok') {
    useAuthStore.getState().setCsrfToken(central.data.csrfToken ?? null);
    return 'central-alive';
  }
  return 'unknown';
}
