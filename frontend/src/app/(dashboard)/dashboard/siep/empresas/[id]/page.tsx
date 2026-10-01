'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  siepService,
  type SiepCapacitacion,
  type SiepEmpresa,
  type SiepGarantia,
} from '@/services/siep.service';

function display(value?: string | null): string {
  const v = value?.trim();
  return v ? v : '—';
}

function geoLabel(
  item: { codigo: string; nombre: string } | null | undefined
): string {
  if (!item) return '—';
  return `${item.nombre} (${item.codigo})`;
}

function isActiva(estadoNombre?: string | null): boolean {
  return (estadoNombre || '').toLowerCase().includes('activ');
}

function Field({
  label,
  value,
  emphasize,
  className,
}: {
  label: string;
  value?: string | null;
  emphasize?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd
        className={
          emphasize
            ? 'mt-1 text-base font-semibold text-gray-900'
            : 'mt-1 text-sm font-medium text-gray-800'
        }
      >
        {display(value)}
      </dd>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyCollection({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center">
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

function StatusPill({ nombre }: { nombre?: string | null }) {
  const activa = isActiva(nombre);
  return (
    <span
      className={
        activa
          ? 'inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/15'
          : 'inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 ring-1 ring-inset ring-gray-500/10'
      }
    >
      {display(nombre)}
    </span>
  );
}

export default function SiepEmpresaDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = String(params.id || '');
  const fromDocumento = searchParams.get('documento') || '';

  const [empresa, setEmpresa] = useState<SiepEmpresa | null>(null);
  const [garantias, setGarantias] = useState<SiepGarantia[]>([]);
  const [capacitaciones, setCapacitaciones] = useState<SiepCapacitacion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [emp, gars, caps] = await Promise.all([
          siepService.getEmpresa(id),
          siepService.getEmpresaGarantias(id).catch(() => [] as SiepGarantia[]),
          siepService.getEmpresaCapacitaciones(id).catch(() => [] as SiepCapacitacion[]),
        ]);
        if (cancelled) return;
        setEmpresa(emp);
        setGarantias(gars);
        setCapacitaciones(caps);
      } catch (err) {
        if (cancelled) return;
        const message =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data
                ?.error?.message
            : undefined;
        setError(message || 'No se pudo cargar la empresa en SIEP.');
        setEmpresa(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const backHref = fromDocumento
    ? `/dashboard/siep?documento=${encodeURIComponent(fromDocumento)}`
    : '/dashboard/siep';

  const copyId = async () => {
    const value = empresa?.id;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('ID SIEP copiado');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('No se pudo copiar el ID');
    }
  };

  const rucConDv =
    empresa?.ruc && empresa?.dv
      ? `${empresa.ruc} D.V. ${empresa.dv}`
      : empresa?.ruc || null;

  const titulo = empresa?.razonSocial || empresa?.nombreComercial || 'Empresa SIEP';

  return (
    <div className="-mx-1 space-y-6 sm:space-y-7">
      {isLoading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-2xl border border-red-100 bg-white px-5 py-4 text-sm text-red-600 shadow-sm">
          {error}
        </div>
      )}

      {!isLoading && !error && !empresa && (
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-10 text-center shadow-sm">
          <p className="text-sm font-medium text-gray-900">Empresa no encontrada</p>
          <p className="mt-1 text-sm text-gray-500">
            No existe una empresa con ese identificador en SIEP.
          </p>
          <div className="mt-5">
            <Link href={backHref}>
              <Button variant="outline" icon={<ArrowLeft className="h-4 w-4" />}>
                Volver
              </Button>
            </Link>
          </div>
        </div>
      )}

      {!isLoading && empresa && (
        <>
          {/* Encabezado */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <nav className="text-sm text-gray-500" aria-label="Miga de pan">
                <Link href="/dashboard/siep" className="font-medium text-primary-700 hover:underline">
                  SIEP
                </Link>
                <span className="mx-1.5 text-gray-300">/</span>
                <span className="text-gray-600">Detalle de empresa</span>
              </nav>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-[1.75rem]">
                  {titulo}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Detalle completo de la empresa en el registro SIEP
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
                <StatusPill nombre={empresa.estado?.nombre} />
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-xs font-medium text-gray-500">ID SIEP:</span>
                  <code className="truncate rounded-md bg-gray-100 px-2 py-1 font-mono text-[11px] text-gray-600 sm:text-xs">
                    {empresa.id}
                  </code>
                  <button
                    type="button"
                    onClick={copyId}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                    title="Copiar ID SIEP"
                    aria-label="Copiar ID SIEP"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="shrink-0 lg:pt-1">
              <Link href={backHref}>
                <Button variant="outline" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
                  Volver
                </Button>
              </Link>
            </div>
          </div>

          {/* Información general */}
          <SectionCard title="Información general">
            <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Nombre comercial" value={empresa.nombreComercial} emphasize />
              <Field label="Nombre completo" value={empresa.nombreCompleto} emphasize />
              <Field label="RUC" value={rucConDv || empresa.ruc} emphasize />
              <Field label="DV" value={empresa.dv} />
              <Field label="Año" value={empresa.anio} />
              <Field label="Fecha de inicio de actividad" value={empresa.fechaInicioAct} />
              <Field label="Fecha de aprobación" value={empresa.fechaAprobacion} />
              <Field label="Usuario de aprobación" value={empresa.usuarioAprobacion} />
              <div className="sm:col-span-2 xl:col-span-4">
                <dt className="text-xs font-medium text-gray-500">Estado actual</dt>
                <dd className="mt-2">
                  <div
                    className={
                      isActiva(empresa.estado?.nombre)
                        ? 'inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 ring-1 ring-inset ring-emerald-600/10'
                        : 'inline-flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 ring-1 ring-inset ring-gray-500/10'
                    }
                  >
                    <span
                      className={
                        isActiva(empresa.estado?.nombre)
                          ? 'h-2 w-2 rounded-full bg-emerald-500'
                          : 'h-2 w-2 rounded-full bg-gray-400'
                      }
                      aria-hidden
                    />
                    <span
                      className={
                        isActiva(empresa.estado?.nombre)
                          ? 'text-sm font-semibold text-emerald-800'
                          : 'text-sm font-semibold text-gray-700'
                      }
                    >
                      {display(empresa.estado?.nombre)}
                    </span>
                  </div>
                </dd>
              </div>
            </dl>
          </SectionCard>

          {/* Actividad económica */}
          <SectionCard title="Actividad económica">
            <div className="space-y-5">
              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <Field label="Sector" value={empresa.actividad?.sector?.nombre} emphasize />
                <div>
                  <dt className="text-xs font-medium text-gray-400">Código de sector</dt>
                  <dd className="mt-1 font-mono text-sm text-gray-500">
                    {display(empresa.actividad?.sector?.codigo)}
                  </dd>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 px-4 py-4">
                <dt className="text-xs font-medium text-gray-500">Actividad</dt>
                <dd className="mt-1 text-base font-semibold text-gray-900">
                  {display(empresa.actividad?.nombre)}
                </dd>
                <p className="mt-2 font-mono text-xs text-gray-500">
                  Código: {display(empresa.actividad?.codigo)}
                </p>
              </div>

              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <Field label="Subactividad" value={empresa.subactividad?.nombre} />
                <div>
                  <dt className="text-xs font-medium text-gray-400">Código de subactividad</dt>
                  <dd className="mt-1 font-mono text-sm text-gray-500">
                    {display(empresa.subactividad?.codigo)}
                  </dd>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Ubicación */}
          <SectionCard title="Ubicación">
            <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-3">
              <Field label="Provincia" value={geoLabel(empresa.ubicacion.provincia)} emphasize />
              <Field label="Distrito" value={geoLabel(empresa.ubicacion.distrito)} emphasize />
              <Field
                label="Corregimiento"
                value={geoLabel(empresa.ubicacion.corregimiento)}
                emphasize
              />
              <Field
                label="Dirección"
                value={empresa.ubicacion.direccion}
                emphasize
                className="sm:col-span-3"
              />
            </dl>
          </SectionCard>

          {/* Garantías */}
          <SectionCard title={`Garantías (${garantias.length})`}>
            {garantias.length === 0 ? (
              <EmptyCollection message="Sin garantías registradas." />
            ) : (
              <ul className="space-y-3">
                {garantias.map((g) => (
                  <li
                    key={g.id}
                    className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {g.efin?.nombre || 'Entidad financiera no indicada'}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Monto: {display(g.monto)}
                        {g.fecha ? ` · Fecha: ${g.fecha}` : ''}
                      </p>
                    </div>
                    {g.estado && <StatusPill nombre={g.estado.nombre} />}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Capacitaciones */}
          <SectionCard title={`Capacitaciones (${capacitaciones.length})`}>
            {capacitaciones.length === 0 ? (
              <EmptyCollection message="Sin capacitaciones registradas." />
            ) : (
              <ul className="space-y-3">
                {capacitaciones.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-gray-900">{c.nombre}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {c.programa?.nombre ? `Programa: ${c.programa.nombre}` : 'Sin programa'}
                      {c.fecha ? ` · ${c.fecha}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Origen */}
          <div
            role="note"
            className="rounded-xl border border-primary-100 bg-primary-50/70 px-4 py-3 text-sm text-primary-900"
          >
            Esta información proviene del registro SIEP y se muestra únicamente para consulta.
          </div>
        </>
      )}
    </div>
  );
}
