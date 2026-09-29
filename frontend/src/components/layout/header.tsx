'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, ChevronDown, LogOut, Menu, Settings } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

const SECTION_TITLES: { prefix: string; title: string }[] = [
  { prefix: '/dashboard/persons', title: 'Personas' },
  { prefix: '/dashboard/companies', title: 'Empresas' },
  { prefix: '/dashboard/events', title: 'Eventos' },
  { prefix: '/dashboard/portfolio', title: 'Seguimiento' },
  { prefix: '/settings/users', title: 'Usuarios' },
  { prefix: '/settings/sedes', title: 'Sedes' },
  { prefix: '/settings/departamento', title: 'Departamentos' },
  { prefix: '/settings/audit', title: 'Auditoría' },
  { prefix: '/settings', title: 'Configuración' },
  { prefix: '/dashboard/imports', title: 'Importaciones' },
  { prefix: '/dashboard/intake', title: 'Verificación' },
];

function sectionTitle(pathname: string | null): string {
  if (!pathname) return 'Dashboard';
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const match = SECTION_TITLES.find((item) => path === item.prefix || path.startsWith(`${item.prefix}/`));
  return match?.title ?? 'Dashboard';
}

function initials(firstName?: string, lastName?: string): string {
  const a = firstName?.trim().charAt(0) ?? '';
  const b = lastName?.trim().charAt(0) ?? '';
  return (a + b).toUpperCase() || 'U';
}

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const title = sectionTitle(pathname);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
        <p className="truncate text-base font-semibold text-slate-900">{title}</p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
        </button>

        {user && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-50"
              aria-expanded={open}
              aria-haspopup="menu"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                {initials(user.firstName, user.lastName)}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-medium leading-tight text-slate-900">
                  {user.firstName} {user.lastName}
                </span>
                <span className="block max-w-[180px] truncate text-xs text-slate-500">{user.username || 'usuario'}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
            </button>

            {open && (
              <div
                role="menu"
                className="absolute right-0 z-30 mt-2 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
              >
                <Link
                  href="/settings"
                  role="menuitem"
                  className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                >
                  <Settings className="h-4 w-4" aria-hidden />
                  Configuración
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  Salir
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
