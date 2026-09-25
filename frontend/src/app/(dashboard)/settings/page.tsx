'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { isFullAccessRole } from '@/lib/roles';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';

const sections = [
  { href: '/settings/users', title: 'Usuarios', description: 'Asigne la sede y el departamento de cada usuario.' },
  { href: '/settings/sedes', title: 'Sedes', description: 'Cree, edite o elimine sedes.' },
  { href: '/settings/departamento', title: 'Departamentos', description: 'Cree, edite o elimine departamentos.' },
  { href: '/settings/audit', title: 'Auditoría', description: 'Consulte el registro de acciones del sistema.' },
];

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = isFullAccessRole(user?.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Administración de usuarios, sedes, departamentos y auditoría"
      />
      {isAdmin ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {sections.map((section) => (
            <Link key={section.href} href={section.href} className="block">
              <Card className="h-full p-6 transition hover:-translate-y-0.5 hover:shadow-md">
                <h2 className="text-base font-semibold text-slate-900">{section.title}</h2>
                <p className="mt-2 text-sm text-slate-500">{section.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-6">
          <p className="text-sm text-slate-600">
            Su rol no puede ver usuarios, sedes, departamentos ni auditoría.
          </p>
        </Card>
      )}
    </div>
  );
}
