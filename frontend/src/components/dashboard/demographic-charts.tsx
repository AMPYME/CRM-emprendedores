'use client';

import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { demographicsService, type DemographicSlice } from '@/services/demographics.service';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

function BarList({ items, color }: { items: DemographicSlice[]; color: string }) {
  const max = Math.max(1, ...items.map((item) => item.total));
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-700">{item.label}</span>
            <span className="font-semibold tabular-nums text-slate-900">{item.total}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full"
              style={{ width: `${Math.max(item.total > 0 ? 4 : 0, (item.total / max) * 100)}%`, background: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-[14px] border border-[#e2e8f0] bg-white p-5 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
      <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 mb-4 text-[13px] text-slate-500">{description}</p>
      {children}
    </article>
  );
}

export function DemographicCharts() {
  const query = useQuery({
    queryKey: ['stats', 'demographics'],
    queryFn: () => demographicsService.get(),
    staleTime: 60 * 1000,
  });

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-[22px] font-bold text-[#0f172a]">Padrón de personas</h2>
      {query.isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner text="Cargando gráficas..." />
        </div>
      ) : query.isError || !query.data ? (
        <p className="text-sm text-slate-500">No se pudieron cargar las gráficas del padrón.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ChartCard title="Género" description="Personas activas según el género registrado">
            <BarList items={query.data.gender} color="#2563eb" />
          </ChartCard>
          <ChartCard title="Edad" description="Rangos calculados con la fecha de nacimiento">
            <BarList items={query.data.age} color="#0f766e" />
          </ChartCard>
          <ChartCard title="Extranjero" description="Nacionalidad distinta de Panamá">
            <BarList items={query.data.foreigner} color="#d97706" />
          </ChartCard>
          <ChartCard title="Artesanos" description="Según el carnet de artesano">
            <BarList items={query.data.artisan} color="#7c3aed" />
          </ChartCard>
        </div>
      )}
    </section>
  );
}
