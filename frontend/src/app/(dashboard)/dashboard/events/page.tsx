'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Eye, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SearchBar } from '@/components/ui/search-bar';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Pagination } from '@/components/ui/pagination';
import {
  Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell,
} from '@/components/ui/table';
import { useAmpymeForms } from '@/hooks/use-forms';
import { getApiErrorMessage } from '@/services/api-client';
import { formsService } from '@/services/forms.service';
import { formatDate } from '@/lib/utils';
import {
  ampymeFormStatusBadge,
  ampymeFormStatusLabels,
  computeAmpymeFormStatus,
  filterAmpymeFormsByStatus,
} from '@/lib/ampyme-form-status';
import { isReadOnlyRole } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth.store';
import type { AmpymeForm } from '@/types/forms.types';

const statusOptions = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'open', label: 'Abierto' },
  { value: 'draft', label: 'Borrador' },
  { value: 'closed', label: 'Cerrado' },
  { value: 'active', label: 'Activo' },
  { value: 'future_open', label: 'Próxima apertura' },
  { value: 'expired', label: 'Expirado' },
];

function matchesSearch(form: AmpymeForm, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    form.form_name,
    form.description,
    form.conferencista,
    form.ubicacion,
    String(form.id),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

const EVENTS_PAGE_SIZE = 10;

export default function EventsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const user = useAuthStore((s) => s.user);
  const readOnly = isReadOnlyRole(user?.role);

  const { data, isLoading, error } = useAmpymeForms();

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setPage(1);
  }, []);

  const filteredForms = useMemo(() => {
    const forms = data?.forms ?? [];
    const byStatus = filterAmpymeFormsByStatus(forms, statusFilter);
    return byStatus.filter((form) => matchesSearch(form, searchQuery));
  }, [data?.forms, statusFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredForms.length / EVENTS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedForms = filteredForms.slice(
    (currentPage - 1) * EVENTS_PAGE_SIZE,
    currentPage * EVENTS_PAGE_SIZE
  );

  const totalForms = data?.forms?.length ?? 0;
  const hasFilteredOut = totalForms > 0 && filteredForms.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Eventos"
        description="Eventos y capacitaciones de AMPYME"
        actions={
          readOnly ? undefined : (
            <Button
              variant="outline"
              icon={<ExternalLink className="h-4 w-4" />}
              onClick={() => window.open(formsService.getAdminLoginUrl(), '_blank', 'noopener,noreferrer')}
            >
              Administrar inscripciones
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <SearchBar
              placeholder="Buscar evento, conferencista, ubicación..."
              onSearch={handleSearch}
              initialQuery={searchQuery}
            />
          </div>
          <div className="w-full sm:w-56">
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        {data && (
          <p className="mt-3 text-xs text-gray-500">
            {filteredForms.length !== (data.forms?.length ?? 0) && data.forms?.length
              ? `${filteredForms.length} de ${data.forms.length} evento${data.forms.length === 1 ? '' : 's'}`
              : data.forms?.length
                ? `${data.forms.length} evento${data.forms.length === 1 ? '' : 's'}`
                : ''}
          </p>
        )}
      </Card>

      <Card className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" text="Cargando eventos..." />
          </div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-500">
            Error al cargar los eventos: {getApiErrorMessage(error)}
          </div>
        ) : filteredForms.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title={hasFilteredOut ? 'Sin resultados para el filtro' : 'No hay eventos'}
            description={
              hasFilteredOut
                ? `Hay ${totalForms} evento${totalForms === 1 ? '' : 's'}, pero ninguno coincide con el filtro seleccionado.`
                : searchQuery
                  ? 'No se encontraron resultados para tu búsqueda.'
                  : 'No hay eventos o formularios registrados.'
            }
            action={
              hasFilteredOut ? (
                <Button variant="outline" onClick={() => { setStatusFilter('all'); setSearchQuery(''); setPage(1); }}>
                  Ver todos
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Nombre</TableHeaderCell>
                <TableHeaderCell>Evento</TableHeaderCell>
                <TableHeaderCell>Inscritos</TableHeaderCell>
                <TableHeaderCell>Ubicación</TableHeaderCell>
                <TableHeaderCell>Estado</TableHeaderCell>
                <TableHeaderCell align="right">Acciones</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedForms.map((form) => {
                const status = computeAmpymeFormStatus(form);
                return (
                  <TableRow key={form.id}>
                    <TableCell>
                      <p className="font-medium text-gray-900">{form.form_name}</p>
                      {form.description && (
                        <p className="text-xs text-gray-400 truncate max-w-[280px]">{form.description}</p>
                      )}
                      {form.conferencista && (
                        <p className="text-xs text-gray-500 mt-0.5">Conferencista: {form.conferencista}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {form.event_date ? formatDate(form.event_date) : '—'}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium tabular-nums">
                        {form.submission_count ?? 0}
                      </span>
                      {form.inscription_limit != null && (
                        <span className="text-xs text-gray-400"> / {form.inscription_limit}</span>
                      )}
                    </TableCell>
                    <TableCell>{form.ubicacion || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={ampymeFormStatusBadge[status]}>
                        {ampymeFormStatusLabels[status]}
                      </Badge>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Ver detalle"
                        onClick={() => router.push(`/dashboard/events/${form.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {filteredForms.length > EVENTS_PAGE_SIZE && (
          <div className="border-t px-4 py-3">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
