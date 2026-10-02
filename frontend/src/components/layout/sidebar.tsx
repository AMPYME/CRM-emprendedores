'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarDays,
  Briefcase,
  FileSpreadsheet,
  BadgeCheck,
  RadioTower,
  Sprout,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  X,
  Database,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { canAccessNav } from '@/lib/roles';
import { useCallback, useEffect, useState } from 'react';
import styles from './sidebar.module.css';

const STORAGE_KEY = 'sidebarCollapsed';

const navigation = [
  { id: 'home', name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { id: 'persons', name: 'Personas', href: '/dashboard/persons', icon: Users },
  { id: 'companies', name: 'Empresas', href: '/dashboard/companies', icon: Building2 },
  { id: 'siep', name: 'SIEP', href: '/dashboard/siep', icon: Database },
  { id: 'capital-semilla', name: 'Capital Semilla', href: '/dashboard/capital-semilla', icon: Sprout },
  { id: 'registro-empresarial', name: 'Registro empresarial', href: '/registro-empresarial', icon: BadgeCheck },
  { id: 'confirmacion', name: 'Confirmación', href: '/confirmacion', icon: ClipboardCheck },
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

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const navItems: NavItem[] = navigation.filter((item) =>
    canAccessNav(user?.role, item.id)
  );

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setCollapsed(stored === 'true');
    } else if (
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 768px) and (max-width: 1023px)').matches
    ) {
      // Tablet: preferir compacto si no hay preferencia guardada
      setCollapsed(true);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed, hydrated]);

  useEffect(() => {
    onMobileClose();
  }, [pathname, onMobileClose]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onMobileClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, onMobileClose]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => !value);
  }, []);

  /** En mobile el drawer siempre se muestra expandido (icono + texto horizontal). */
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
          'fixed inset-y-0 left-0 z-50 flex min-h-screen flex-col text-white',
          'md:static md:z-auto md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          'w-[240px] md:transition-[width,padding] md:duration-200 md:ease-in-out',
          compact ? 'md:w-[80px]' : 'md:w-[240px]'
        )}
        style={{
          background: 'linear-gradient(180deg, #1e3a8a 0%, #1d4ed8 100%)',
        }}
        aria-label="Navegación principal"
        data-collapsed={compact ? 'true' : 'false'}
      >
        <div
          className={cn(
            'flex items-center justify-between gap-2 px-4 pb-2 pt-5',
            compact && 'md:flex-col md:justify-start md:px-2'
          )}
        >
          <Link
            href="/dashboard"
            className={cn(
              'flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
              compact && 'md:flex-col md:justify-center md:gap-1.5'
            )}
            aria-label="AMPYME CRM — Ir al dashboard"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/emprendedores-icon.svg"
                alt=""
                className="h-8 w-8 object-contain"
              />
            </span>
            <span
              className={cn(
                'truncate text-[15px] font-semibold tracking-tight',
                compact && 'md:hidden'
              )}
            >
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
            onClick={toggleCollapsed}
            className={cn(
              'hidden rounded-lg p-2 text-white/80 hover:bg-white/10 md:inline-flex',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
              compact && 'md:mx-auto'
            )}
            aria-label={compact ? 'Expandir menú lateral' : 'Contraer menú lateral'}
            aria-expanded={!compact}
            title={compact ? 'Expandir menú' : 'Contraer menú'}
          >
            {compact ? (
              <ChevronRight className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronLeft className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>

        <nav
          className={cn(
            'mt-4 flex-1 space-y-1.5 overflow-y-auto px-3 pb-4',
            compact && 'md:space-y-1 md:px-1.5'
          )}
          aria-label="Módulos"
        >
          {navItems.map((item) => {
            const isActive = isNavItemActive(item, pathname);
            return (
              <div
                key={item.id}
                className={cn('relative', compact && styles.itemCompact)}
              >
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.name}
                  className={cn(
                    'rounded-[10px] text-white transition-colors',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
                    isActive ? 'bg-white/15 font-semibold' : 'font-medium hover:bg-white/10',
                    'flex min-h-11 items-center gap-3 px-3 py-2.5 text-sm',
                    compact &&
                      'md:min-h-[62px] md:flex-col md:items-center md:justify-center md:gap-1 md:px-1 md:py-2 md:text-center'
                  )}
                  style={
                    isActive
                      ? {
                          background: 'rgba(255,255,255,0.14)',
                          boxShadow: 'inset 3px 0 0 rgba(255,255,255,0.85)',
                        }
                      : undefined
                  }
                >
                  <item.icon className="h-5 w-5 shrink-0" aria-hidden />
                  <span className={cn('truncate', compact && 'md:hidden')}>
                    {item.name}
                  </span>
                  {compact ? (
                    <span className={cn('hidden md:block', styles.labelCompact)}>
                      {item.name}
                    </span>
                  ) : null}
                </Link>

                {compact && (
                  <span className={cn('hidden md:block', styles.tooltip)} role="tooltip">
                    {item.name}
                  </span>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
