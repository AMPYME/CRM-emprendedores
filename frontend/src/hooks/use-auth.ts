'use client';

/**
 * Hook de autenticación.
 * Inicializa la sesión y verifica el token con el backend.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';

export function useAuth({ requireAuth = true }: { requireAuth?: boolean } = {}) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, setAuth, setUser, setLoading, logout, initialize } = useAuthStore();

  useEffect(() => {
    const init = async () => {
      initialize();

      const token = localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refreshToken');

      if (!token || !refreshToken) {
        setLoading(false);
        if (requireAuth) {
          router.replace('/login');
        }
        return;
      }

      // Evita carrera tras login: si el store ya tiene usuario (setAuth en la página de login),
      // no repetir GET /auth/profile; un fallo intermitente aquí dejaba la sesión en blanco.
      if (useAuthStore.getState().user) {
        setLoading(false);
        return;
      }

      try {
        // Verificar token obteniendo perfil
        const profile = await authService.getProfile();
        setUser(profile);
        setLoading(false);
      } catch {
        // Token inválido → intentar refresh
        try {
          const result = await authService.refresh(refreshToken);
          // Algunos backends no devuelven `user` en refresh; si falta, pedir perfil.
          const profile = result.user ?? await authService.getProfile();
          setAuth(profile, result.accessToken, result.refreshToken);
        } catch {
          logout();
          if (requireAuth) {
            router.replace('/login');
          }
        }
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, isAuthenticated, isLoading };
}
