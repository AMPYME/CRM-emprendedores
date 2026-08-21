'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, ExternalLink, MapPin, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import {
  Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell,
} from '@/components/ui/table';
import { useAmpymeForm, useAmpymeFormSubmissions } from '@/hooks/use-forms';
import { usePagination } from '@/hooks/use-pagination';
import { formsService } from '@/services/forms.service';
import { formatDate } from '@/lib/utils';
import {
  ampymeFormStatusBadge,
  ampymeFormStatusLabels,
  computeAmpymeFormStatus,
  isFormOpen,
} from '@/lib/ampyme-form-status';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { page, limit, setPage } = usePagination({ initialLimit: 25 });
  const { data: form, isLoading, error } = useAmpymeForm(id);
  const submissions = useAmpymeFormSubmissions(id, { page, limit });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" text="Cargando formulario..." />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-red-500">No se pudo cargar el formulario del evento.</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/events')}>
          Volver
        </Button>
      </div>
    );
  }

  const status = computeAmpymeFormStatus(form);
  const formIsOpen = isFormOpen(form);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/events')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2.5">
              <Calendar className="h-6 w-6 text-blue-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 truncate">{form.form_name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={ampymeFormStatusBadge[status]}>
                  {ampymeFormStatusLabels[status]}
                </Badge>
                <span className="text-xs text-gray-400">ID {form.id}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<ExternalLink className="h-4 w-4" />}
            disabled={!formIsOpen}
            title={
              formIsOpen
                ? 'Abrir formulario público'
                : 'El formulario no está abierto para inscripciones'
            }
            onClick={() =>
              window.open(formsService.getPublicFormUrl(form.id), '_blank', 'noopener,noreferrer')
            }
          >
            Formulario público
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Detalles del formulario">
            {form.description && (
              <p className="mb-4 text-sm text-gray-600">{form.description}</p>
            )}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <InfoRow label="Nombre" value={form.form_name} span2 />
              <InfoRow label="Fecha del evento" value={form.event_date ? formatDate(form.event_date) : null} />
              <InfoRow label="Apertura" value={form.open_at ? formatDate(form.open_at) : null} />
              <InfoRow label="Cierre" value={form.expires_at ? formatDate(form.expires_at) : null} />
              <InfoRow label="Creado" value={form.created_at ? formatDate(form.created_at) : null} />
              <InfoRow
                label="Cupo"
                value={
                  form.inscription_limit != null ? String(form.inscription_limit) : 'Sin límite'
                }
              />
              <InfoRow
                label="Inscripciones"
                value={
                  form.submission_count != null ? String(form.submission_count) : '0'
                }
              />
            </dl>
          </Card>
        </div>

        <div className="space-y-4">
          {form.conferencista && (
            <Card>
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                    Conferencista
                  </p>
                  <p className="mt-1 text-sm text-gray-900">{form.conferencista}</p>
                </div>
              </div>
            </Card>
          )}
          {form.ubicacion && (
            <Card>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                    Ubicación
                  </p>
                  <p className="mt-1 text-sm text-gray-900">{form.ubicacion}</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Card
        title="Personas inscritas"
        description={
          form.submission_count != null
            ? `${form.submission_count.toLocaleString('es-PA')} inscripciones en total`
            : undefined
        }
      >
        {submissions.isLoading ? (
          <LoadingSpinner text="Cargando inscripciones..." />
        ) : submissions.error ? (
          <p className="text-sm text-red-500">No se pudieron cargar las inscripciones.</p>
        ) : !submissions.data || submissions.data.data.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Sin inscripciones"
            description="Aún no hay personas inscritas en este formulario."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Persona</TableHeaderCell>
                    <TableHeaderCell>Provincia</TableHeaderCell>
                    <TableHeaderCell>Contacto</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {submissions.data.data.map((person) => (
                    <TableRow key={person.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-mono text-sm font-semibold text-gray-900">
                            {person.cedula || '—'}
                          </p>
                          <p className="text-sm text-gray-800">{person.nombre || '—'}</p>
                          <p className="text-sm text-gray-600">{person.apellido || '—'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-700">{person.provincia || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-900">{person.telefono || '—'}</p>
                          <p className="text-xs text-gray-500 break-all">{person.email || '—'}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {submissions.data.meta && submissions.data.meta.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <p className="text-sm text-gray-500">
                  {(submissions.data.meta.page - 1) * submissions.data.meta.limit + 1}
                  {' - '}
                  {Math.min(
                    submissions.data.meta.page * submissions.data.meta.limit,
                    submissions.data.meta.total
                  )}
                  {' de '}
                  {submissions.data.meta.total}
                </p>
                <Pagination
                  currentPage={submissions.data.meta.page}
                  totalPages={submissions.data.meta.totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function InfoRow({
  label,
  value,
  span2,
}: {
  label: string;
  value: string | null | undefined;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <dt className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-gray-900">
        {value ? value : <span className="text-gray-300">—</span>}
      </dd>
    </div>
  );
}
