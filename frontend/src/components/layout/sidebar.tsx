'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Building2,
  Search,
  CalendarDays,
  Briefcase,
  FileSpreadsheet,
  RadioTower,
  Settings,
  LogOut,
  ChevronLeft,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { canAccessNav } from '@/lib/roles';
import { useEffect, useState } from 'react';

const navigation = [
  { id: 'home', name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { id: 'search', name: 'Buscar', href: '/dashboard', icon: Search },
  { id: 'persons', name: 'Personas', href: '/dashboard/persons', icon: Users },
  { id: 'companies', name: 'Empresas', href: '/dashboard/companies', icon: Building2 },
  { id: 'events', name: 'Eventos', href: '/dashboard/events', icon: CalendarDays },
  { id: 'portfolio', name: 'Seguimiento', href: '/dashboard/portfolio', icon: Briefcase },
  { id: 'imports', name: 'Importaciones', href: '/dashboard/imports', icon: FileSpreadsheet },
  { id: 'intake', name: 'Verificación', href: '/dashboard/intake', icon: RadioTower },
] as const;

type NavItem = (typeof navigation)[number];

function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
}

function isNavItemActive(item: NavItem, pathname: string | null): boolean {
  if (!pathname) return false;
  const path = normalizePath(pathname);

  if (item.href === '/dashboard') {
    if (path !== '/dashboard') return false;
    return item.id === 'home';
  }

  return path === item.href || path.startsWith(`${item.href}/`);
}

function initials(firstName?: string, lastName?: string): string {
  const a = firstName?.trim().charAt(0) ?? '';
  const b = lastName?.trim().charAt(0) ?? '';
  return (a + b).toUpperCase() || 'U';
}

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const navItems: NavItem[] = navigation.filter((item) =>
    canAccessNav(user?.role, item.id)
  );

  useEffect(() => {
    onMobileClose();
  }, [pathname, onMobileClose]);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const compact = collapsed;

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-900/40 transition-opacity md:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onMobileClose}
        aria-hidden={!mobileOpen}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex min-h-screen w-[250px] flex-col text-white transition-all duration-300',
          'md:static md:z-auto md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          compact && 'md:w-[76px] lg:w-[250px]'
        )}
        style={{
          background: 'linear-gradient(180deg, #1e3a8a 0%, #1d4ed8 100%)',
        }}
        aria-label="Navegación principal"
      >
        <div className={cn('flex items-center justify-between gap-2 px-4 pb-2 pt-6', compact && 'md:flex-col md:px-2 lg:flex-row lg:px-4')}>
          <Link
            href="/dashboard"
            className={cn(
              'flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
              compact && 'md:justify-center lg:justify-start'
            )}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/emprendedores-icon.svg"
                alt=""
                className="h-8 w-8 object-contain"
              />
            </span>
            <span className={cn('truncate text-[15px] font-semibold tracking-tight', compact && 'md:hidden lg:inline')}>
              AMPYME CRM
            </span>
          </Link>

          <button
            type="button"
            onClick={onMobileClose}
            className="rounded-lg p-2 text-white/80 hover:bg-white/10 md:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className={cn(
              'hidden rounded-lg p-2 text-white/80 hover:bg-white/10 md:inline-flex lg:hidden',
              compact && 'md:mx-auto'
            )}
            aria-label={compact ? 'Expandir menú' : 'Contraer menú'}
          >
            <ChevronLeft className={cn('h-4 w-4 transition-transform', compact && 'rotate-180')} />
          </button>
        </div>

        <nav className="mt-6 flex-1 space-y-1.5 overflow-y-auto px-3 pb-4">
          {navItems.map((item) => {
            const isActive = isNavItemActive(item, pathname);
            return (
              <Link
                key={item.id}
                href={item.href}
                title={item.name}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-white transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
                  isActive ? 'bg-white/15' : 'hover:bg-white/10',
                  compact && 'md:justify-center md:px-2 lg:justify-start lg:px-3'
                )}
                style={isActive ? { background: 'rgba(255,255,255,0.14)' } : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className={cn(compact && 'md:hidden lg:inline')}>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/15 px-3 py-4">
          {user && (
            <div className={cn('mb-3 flex items-center gap-3 px-2', compact && 'md:justify-center lg:justify-start')}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold">
                {initials(user.firstName, user.lastName)}
              </span>
              <div className={cn('min-w-0', compact && 'md:hidden lg:block')}>
                <p className="truncate text-sm font-semibold">
                  {user.firstName} {user.lastName}
                </p>
                {user.sede?.name && (
                  <p className="truncate text-xs text-white/75">{user.sede.name}</p>
                )}
                {user.departamento?.name && (
                  <p className="truncate text-xs text-white/75">{user.departamento.name}</p>
                )}
              </div>
            </div>
          )}

          <Link
            href="/settings"
            title="Configuración"
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2 text-sm text-white/90 hover:bg-white/10',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
              compact && 'md:justify-center lg:justify-start'
            )}
          >
            <Settings className="h-4 w-4 shrink-0" aria-hidden />
            <span className={cn(compact && 'md:hidden lg:inline')}>Configuración</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            title="Salir"
            className={cn(
              'flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 py-2 text-sm text-white/90 hover:bg-white/10',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
              compact && 'md:justify-center lg:justify-start'
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
            <span className={cn(compact && 'md:hidden lg:inline')}>Salir</span>
          </button>
        </div>
      </aside>
    </>
  );
}
