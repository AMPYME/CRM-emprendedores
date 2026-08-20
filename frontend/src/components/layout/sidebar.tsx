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
  Shield,
  Settings,
  LogOut,
  ChevronLeft,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { canAccessNav, roleLabel } from '@/lib/roles';
import { useState } from 'react';

const navigation = [
  { id: 'home', name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { id: 'search', name: 'Buscar', href: '/dashboard', icon: Search },
  { id: 'persons', name: 'Personas', href: '/dashboard/persons', icon: Users },
  { id: 'companies', name: 'Empresas', href: '/dashboard/companies', icon: Building2 },
  { id: 'events', name: 'Eventos', href: '/dashboard/events', icon: CalendarDays },
  { id: 'portfolio', name: 'Cartera', href: '/dashboard/portfolio', icon: Briefcase },
  { id: 'imports', name: 'Importaciones', href: '/dashboard/imports', icon: FileSpreadsheet },
  { id: 'intake', name: 'Verificación', href: '/dashboard/intake', icon: RadioTower },
  { id: 'audit', name: 'Auditoría', href: '/dashboard/audit', icon: Shield },
] as const;

type NavItem = (typeof navigation)[number];

/** Normaliza pathname (sin barra final salvo raíz). */
function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
}

/**
 * Ítem activo: rutas bajo `/dashboard/...` no deben marcar el enlace «/dashboard»
 * (si no, Dashboard y Buscar quedarían siempre resaltados).
 * En la portada exacta `/dashboard`, solo «Dashboard» se marca; «Buscar» comparte URL pero no estado activo.
 */
function isNavItemActive(item: NavItem, pathname: string | null): boolean {
  if (!pathname) return false;
  const path = normalizePath(pathname);

  if (item.href === '/dashboard') {
    if (path !== '/dashboard') return false;
    return item.id === 'home';
  }

  return path === item.href || path.startsWith(`${item.href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const navItems: NavItem[] = navigation.filter((item) =>
    canAccessNav(user?.role, item.id)
  );

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-gray-200 bg-white transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-gray-100 px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white font-bold text-sm">
              A
            </div>
            <span className="text-sm font-bold text-gray-900">AMPYME CRM</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600',
            collapsed && 'mx-auto'
          )}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const isActive = isNavItemActive(item, pathname);
          return (
            <Link
              key={item.id}
              href={item.href}
              title={collapsed ? item.name : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                collapsed && 'justify-center px-2'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User area */}
      <div className="border-t border-gray-100 p-3">
        {!collapsed && user && (
          <div className="mb-2 px-3 py-2">
            <p className="truncate text-sm font-medium text-gray-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-xs text-gray-500">{roleLabel(user.role)}</p>
          </div>
        )}
        <div className={cn('flex gap-1', collapsed ? 'flex-col items-center' : '')}>
          <Link
            href="/settings"
            title="Configuración"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <Settings className="h-4 w-4" />
            {!collapsed && <span>Configuración</span>}
          </Link>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Salir</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
