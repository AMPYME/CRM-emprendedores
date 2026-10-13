'use client';

import React from 'react';
import Link from 'next/link';
import { Users, Building2, Calendar, ChevronRight } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { usePersons } from '@/hooks/use-persons';
import { useCompanies } from '@/hooks/use-companies';
import { useEvents } from '@/hooks/use-events';
import { useAuthStore } from '@/stores/auth.store';
import { canAccessNav } from '@/lib/roles';
import { DemographicCharts } from '@/components/dashboard/demographic-charts';

function DashboardScene() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute bottom-0 right-0 h-56 w-[420px] max-w-full opacity-45"
      viewBox="0 0 420 220"
      fill="none"
    >
      <path d="M0 170c40-28 70-28 110 0s70 28 110 0 70-28 110 0 60 24 90 8v42H0V170z" fill="#edf4fa" />
      <path d="M20 186c36-18 62-18 96 0s58 16 94-2 64-20 100 0 62 18 90 6v30H20v-34z" fill="#eaf2fb" />
      <ellipse cx="78" cy="48" rx="28" ry="14" fill="#dce8f5" />
      <ellipse cx="102" cy="46" rx="22" ry="12" fill="#edf4fa" />
      <ellipse cx="300" cy="36" rx="34" ry="16" fill="#dce8f5" />
      <ellipse cx="328" cy="34" rx="24" ry="12" fill="#eaf2fb" />
      <rect x="168" y="92" width="36" height="78" rx="3" fill="#dce8f5" />
      <rect x="210" y="68" width="28" height="102" rx="3" fill="#eaf2fb" />
      <rect x="244" y="84" width="42" height="86" rx="3" fill="#dce8f5" />
      <rect x="292" y="104" width="24" height="66" rx="3" fill="#edf4fa" />
      <rect x="132" y="112" width="22" height="58" rx="3" fill="#eaf2fb" />
    </svg>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  caption: string;
  href: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  cardBg: string;
}

function MetricCard({
  title,
  value,
  caption,
  href,
  icon: Icon,
  iconColor,
  iconBg,
  cardBg,
}: MetricCardProps) {
  return (
    <Link
      href={href}
      className="group flex min-h-[148px] items-center gap-4 rounded-[14px] border border-[#e2e8f0] p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      style={{ background: cardBg }}
    >
      <div className="min-w-0 flex-1">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ background: iconBg, color: iconColor }}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <p className="mt-4 text-[15px] font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-[32px] font-bold leading-none text-slate-900">{value}</p>
        <p className="mt-2 text-sm text-slate-500">{caption}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 group-hover:text-slate-600" aria-hidden />
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const role = user?.role;
  const showEvents = canAccessNav(role, 'events');

  const persons = usePersons({ limit: 1 });
  const companies = useCompanies({ limit: 1 });
  const events = useEvents({ limit: 1 });

  const personCount = persons.data?.meta?.total ?? '—';
  const companyCount = companies.data?.meta?.total ?? '—';
  const eventCount = events.data?.meta?.total ?? '—';

  const isLoading =
    persons.isLoading || companies.isLoading || (showEvents && events.isLoading);

  const firstName = user?.firstName ?? 'Usuario';

  return (
    <div className="relative min-h-full">
      <DashboardScene />

      <div className="relative">
        <section className="mb-8">
          <h1 className="text-[32px] font-bold leading-tight text-[#0f172a]">
            ¡Hola, {firstName}!
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#64748b] sm:text-[15px]">
            Bienvenido al Sistema de Gestión de Seguimiento de Emprendedores – AMPYME
          </p>
        </section>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" text="Cargando estadísticas..." />
          </div>
        ) : (
          <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Personas"
              value={personCount}
              caption="Emprendedores registrados"
              href="/dashboard/persons"
              icon={Users}
              iconColor="#2563eb"
              iconBg="#dbeafe"
              cardBg="#f8fbff"
            />
            <MetricCard
              title="Empresas"
              value={companyCount}
              caption="Empresas registradas"
              href="/dashboard/companies"
              icon={Building2}
              iconColor="#10b981"
              iconBg="#d1fae5"
              cardBg="#f7fffb"
            />
            {showEvents && (
              <MetricCard
                title="Eventos"
                value={eventCount}
                caption="Eventos creados"
                href="/dashboard/events"
                icon={Calendar}
                iconColor="#f59e0b"
                iconBg="#fef3c7"
                cardBg="#fffdf7"
              />
            )}
          </section>
        )}

        <DemographicCharts />
      </div>
    </div>
  );
}
