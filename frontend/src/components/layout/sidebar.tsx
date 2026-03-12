'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Building2,
  Store,
  Search,
  CalendarDays,
  Briefcase,
  FileSpreadsheet,
  Settings,
  LogOut,
  ChevronLeft,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Buscar', href: '/dashboard', icon: Search },
  { name: 'Personas', href: '/dashboard/persons', icon: Users },
  { name: 'Empresas', href: '/dashboard/companies', icon: Building2 },
  { name: 'Establecimientos', href: '/dashboard/establishments', icon: Store },
  { name: 'Eventos', href: '/dashboard/events', icon: CalendarDays },
  { name: 'Cartera', href: '/dashboard/portfolio', icon: Briefcase },
  { name: 'Importaciones', href: '/dashboard/imports', icon: FileSpreadsheet },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

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
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
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
            <p className="truncate text-xs text-gray-500">{user.role}</p>
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
