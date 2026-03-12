'use client';

import React from 'react';
import Link from 'next/link';
import {
  Users,
  Building,
  Briefcase,
  Calendar,
  FolderKanban,
  Upload,
  TrendingUp,
  Clock,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PageHeader } from '@/components/layout/page-header';
import { useEntities } from '@/hooks/use-entities';
import { usePersons } from '@/hooks/use-persons';
import { useCompanies } from '@/hooks/use-companies';
import { useEstablishments } from '@/hooks/use-establishments';
import { useEvents } from '@/hooks/use-events';
import { usePortfolioStats } from '@/hooks/use-portfolio';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';

/* ─── Stats card ──────────────────────────────────────── */
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  href: string;
  color: string;
  subtitle?: string;
}

function StatCard({ title, value, icon: Icon, href, color, subtitle }: StatCardProps) {
  return (
    <Link href={href} className="group">
      <Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
        <div className="flex items-center justify-between p-6">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
            {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
          </div>
          <div className={cn('rounded-xl p-3', color)}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </Card>
    </Link>
  );
}

/* ─── Portfolio mini-card ─────────────────────────────── */
interface PortfolioMiniProps {
  label: string;
  count: number;
  icon: React.ElementType;
  variant: 'success' | 'warning' | 'danger' | 'primary';
}

function PortfolioMini({ label, count, icon: Icon, variant }: PortfolioMiniProps) {
  const variantColors = {
    success: 'text-green-600 bg-green-50',
    warning: 'text-yellow-600 bg-yellow-50',
    danger: 'text-red-600 bg-red-50',
    primary: 'text-primary-600 bg-primary-50',
  };
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className={cn('rounded-lg p-2', variantColors[variant])}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{count}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

/* ─── Quick Action ────────────────────────────────────── */
interface QuickActionProps {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  color: string;
}

function QuickAction({ title, description, href, icon: Icon, color }: QuickActionProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-lg border p-4 transition-all hover:shadow-sm hover:border-primary-200 group"
    >
      <div className={cn('rounded-lg p-2.5', color)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 group-hover:text-primary-700">{title}</p>
        <p className="text-xs text-gray-500 truncate">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
    </Link>
  );
}

/* ─── Page ────────────────────────────────────────────── */
export default function DashboardPage() {
  const { user } = useAuthStore();

  const persons = usePersons({ limit: 1 });
  const companies = useCompanies({ limit: 1 });
  const establishments = useEstablishments({ limit: 1 });
  const events = useEvents({ limit: 1 });
  const portfolioStats = usePortfolioStats();

  const personCount = persons.data?.meta?.total ?? '—';
  const companyCount = companies.data?.meta?.total ?? '—';
  const estabCount = establishments.data?.meta?.total ?? '—';
  const eventCount = events.data?.meta?.total ?? '—';

  const isLoading =
    persons.isLoading || companies.isLoading || establishments.isLoading || events.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`¡Hola, ${user?.firstName ?? 'Usuario'}!`}
        description="Bienvenido al Sistema de Gestión de Cartera de Emprendedores - AMPYME"
      />

      {/* ── Stats Grid ───────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" text="Cargando estadísticas..." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Personas"
            value={personCount}
            icon={Users}
            href="/dashboard/persons"
            color="bg-blue-500"
            subtitle="Emprendedores registrados"
          />
          <StatCard
            title="Empresas"
            value={companyCount}
            icon={Building}
            href="/dashboard/companies"
            color="bg-emerald-500"
            subtitle="Empresas registradas"
          />
          <StatCard
            title="Establecimientos"
            value={estabCount}
            icon={Briefcase}
            href="/dashboard/establishments"
            color="bg-purple-500"
            subtitle="Establecimientos registrados"
          />
          <StatCard
            title="Eventos"
            value={eventCount}
            icon={Calendar}
            href="/dashboard/events"
            color="bg-amber-500"
            subtitle="Eventos creados"
          />
        </div>
      )}

      {/* ── Lower half ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Portfolio overview */}
        <div className="lg:col-span-2">
          <Card title="Cartera de Seguimiento" description="Resumen del estado de las gestiones">
            {portfolioStats.isLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : portfolioStats.error ? (
              <p className="py-8 text-center text-sm text-gray-400">
                No se pudieron cargar las estadísticas de cartera.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <PortfolioMini
                    label="Total registros"
                    count={portfolioStats.data?.total ?? 0}
                    icon={FolderKanban}
                    variant="primary"
                  />
                  <PortfolioMini
                    label="Vencidos"
                    count={portfolioStats.data?.overdue ?? 0}
                    icon={AlertTriangle}
                    variant="danger"
                  />
                  <PortfolioMini
                    label="Próximos"
                    count={portfolioStats.data?.upcoming ?? 0}
                    icon={Clock}
                    variant="warning"
                  />
                  <PortfolioMini
                    label="Sin gestión"
                    count={portfolioStats.data?.unmanaged ?? 0}
                    icon={TrendingUp}
                    variant="success"
                  />
                </div>

                {/* Status breakdown */}
                {portfolioStats.data?.byStatus && Object.keys(portfolioStats.data.byStatus).length > 0 && (
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Por estado
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(portfolioStats.data.byStatus).map(([status, count]) => (
                        <Badge key={status} variant="default" className="gap-1.5">
                          {status}: <strong>{count as number}</strong>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <Link href="/dashboard/portfolio">
                    <Button variant="outline" size="sm" icon={<ArrowRight className="h-4 w-4" />}>
                      Ver cartera completa
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Quick actions */}
        <div>
          <Card title="Acciones rápidas" description="Operaciones frecuentes">
            <div className="space-y-3">
              <QuickAction
                title="Registrar persona"
                description="Agregar un nuevo emprendedor"
                href="/dashboard/persons?action=create"
                icon={Users}
                color="bg-blue-500"
              />
              <QuickAction
                title="Registrar empresa"
                description="Agregar una nueva empresa"
                href="/dashboard/companies?action=create"
                icon={Building}
                color="bg-emerald-500"
              />
              <QuickAction
                title="Crear evento"
                description="Organizar un nuevo evento"
                href="/dashboard/events?action=create"
                icon={Calendar}
                color="bg-amber-500"
              />
              <QuickAction
                title="Importar datos"
                description="Carga masiva desde Excel"
                href="/dashboard/imports"
                icon={Upload}
                color="bg-indigo-500"
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
