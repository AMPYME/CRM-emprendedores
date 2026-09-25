'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { href: '/settings/users', label: 'Usuarios' },
  { href: '/settings/sedes', label: 'Sedes' },
  { href: '/settings/departamento', label: 'Departamentos' },
  { href: '/settings/audit', label: 'Auditoría' },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Configuración">
      {links.map((link) => {
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
