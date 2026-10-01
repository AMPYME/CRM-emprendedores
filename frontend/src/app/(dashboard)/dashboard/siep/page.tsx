'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Database, Search, UserRound } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { siepService, type SiepPersona } from '@/services/siep.service';

function fullName(p: SiepPersona): string {
  return [p.firstName, p.lastName, p.secondLastName].filter(Boolean).join(' ');
}

export default function SiepConsultaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentoInicial = searchParams.get('documento') || '';

  const [cedula, setCedula] = useState(documentoInicial);
  const [submitted, setSubmitted] = useState('');
  const [persona, setPersona] = useState<SiepPersona | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consultar = async (documentoRaw: string) => {
    const documento = documentoRaw.trim();
    if (!documento) {
      setError('Ingrese una cédula para consultar SIEP.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setPersona(null);
    setSubmitted(documento);
    router.replace(`/dashboard/siep?documento=${encodeURIComponent(documento)}`);

    try {
      const result = await siepService.findPersonaByCedula(documento);
      setPersona(result);
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
              ?.message
          : undefined;
      setError(message || 'No se pudo consultar SIEP. Intente de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!documentoInicial) return;
    void consultar(documentoInicial);
    // Carga inicial al volver desde el detalle con ?documento=
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await consultar(cedula);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="SIEP"
        description="Consulta de personas registradas en SIEP por número de cédula"
      />

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="siep-cedula" className="mb-1.5 block text-sm font-medium text-gray-700">
              Cédula
            </label>
            <input
              id="siep-cedula"
              type="text"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              placeholder="Ej. 8-888-888"
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              autoComplete="off"
            />
          </div>
          <Button type="submit" isLoading={isLoading} icon={<Search className="h-4 w-4" />}>
            Consultar
          </Button>
        </form>
      </Card>

      {isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      )}

      {!isLoading && error && (
        <Card>
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      {!isLoading && !error && submitted && !persona && (
        <EmptyState
          icon={Database}
          title="Sin resultados en SIEP"
          description={`No se encontró una persona con cédula "${submitted}".`}
        />
      )}

      {!isLoading && persona && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <UserRound className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">{fullName(persona)}</h2>
                  <Badge variant="info">{persona.documentType || 'CEDULA'}</Badge>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Documento: {persona.documentNumber || '—'}
                </p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Correo
                    </dt>
                    <dd className="mt-0.5 text-sm text-gray-800">{persona.email || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Teléfono
                    </dt>
                    <dd className="mt-0.5 text-sm text-gray-800">{persona.phone || '—'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      ID SIEP
                    </dt>
                    <dd className="mt-0.5 break-all font-mono text-xs text-gray-600">{persona.id}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900">
                Empresas vinculadas ({persona.empresas.length})
              </h3>
            </div>
            {persona.empresas.length === 0 ? (
              <p className="text-sm text-gray-500">Sin empresas asociadas en SIEP.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {persona.empresas.map((empresa) => {
                  const detailHref = `/dashboard/siep/empresas/${empresa.id}?documento=${encodeURIComponent(
                    persona.documentNumber || submitted
                  )}`;
                  return (
                    <li
                      key={`${empresa.id}-${empresa.rol}`}
                      className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{empresa.razonSocial}</p>
                        <p className="text-xs text-gray-500">
                          RUC: {empresa.ruc || '—'}
                          {empresa.nombreComercial ? ` · ${empresa.nombreComercial}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="default">{empresa.rol}</Badge>
                        <Link href={detailHref}>
                          <Button variant="outline" size="sm">
                            Ver más
                          </Button>
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
