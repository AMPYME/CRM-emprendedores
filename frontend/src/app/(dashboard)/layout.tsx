'use client';

/**
 * Layout del dashboard (con sidebar y header).
 * Protegido: redirige a /login si no hay sesión.
 * También valida rutas según el rol (viewer / operador).
 */
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageLoading } from '@/components/ui/loading-spinner';
import { canAccessPath } from '@/lib/roles';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, user } = useAuth({ requireAuth: true });
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!user || !pathname) return;
    if (!canAccessPath(user.role, pathname)) {
      router.replace('/dashboard');
    }
  }, [user, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <PageLoading text="Cargando sistema..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <PageLoading text="Sesión no disponible. Redirigiendo a inicio de sesión..." />
      </div>
    );
  }

  if (pathname && !canAccessPath(user.role, pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <PageLoading text="Redirigiendo..." />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={closeMobile} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="relative flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:px-8 md:py-8 lg:px-10 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
