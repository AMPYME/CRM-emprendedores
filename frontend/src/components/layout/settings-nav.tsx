'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { canViewAudit, isFullAccessRole } from '@/lib/roles';

const links = [
  { href: '/settings/confirmaciones', label: 'Mis confirmaciones', access: 'all' as const },
  { href: '/settings/users', label: 'Usuarios', access: 'admin' as const },
  { href: '/settings/sedes', label: 'Sedes', access: 'admin' as const },
  { href: '/settings/departamento', label: 'Departamentos', access: 'admin' as const },
  { href: '/settings/audit', label: 'Auditoría', access: 'audit' as const },
];

export function SettingsNav() {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role);
  const visible = links.filter((link) => {
    if (link.access === 'all') return true;
    if (link.access === 'admin') return isFullAccessRole(role);
    if (link.access === 'audit') return canViewAudit(role);
    return false;
  });

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Configuración">
      {visible.map((link) => {
        const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'rounded-[10px] px-4 py-2 text-sm font-medium',
              active ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
