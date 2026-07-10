'use client';

import React, { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Plus, Eye, Edit, Users as UsersIcon } from 'lucide-react';
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
import { useEvents, useCreateEvent, useUpdateEvent } from '@/hooks/use-events';
import { usePagination } from '@/hooks/use-pagination';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { formatDate } from '@/lib/utils';
import { getProvinciaOptions, provinciaNombre } from '@/lib/division-politica';

const eventTypeOptions = [
  { value: '', label: 'Seleccionar' },
  { value: 'Feria', label: 'Feria' },
  { value: 'Capacitación', label: 'Capacitación' },
  { value: 'Soltando Cinta', label: 'Soltando Cinta' },
  { value: 'Expo', label: 'Expo' },
];

const provinciaFormOptions = getProvinciaOptions();

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'PUBLISHED', label: 'Publicado' },
  { value: 'IN_PROGRESS', label: 'En progreso' },
  { value: 'COMPLETED', label: 'Completado' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

const statusBadgeVariant: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'default',
  PUBLISHED: 'primary',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  PUBLISHED: 'Publicado',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

export default function EventsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showCreate = searchParams.get('action') === 'create';

  const { page, limit, setPage, searchQuery, setSearchQuery } = usePagination();
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(showCreate);

  const { data, isLoading, error } = useEvents({
    page, limit,
    search: searchQuery || undefined,
    status: statusFilter || undefined,
  });

  const createMutation = useCreateEvent();

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setPage(1);
  }, [setSearchQuery, setPage]);

  const { register, handleSubmit, reset, formState: { errors: formErrors } } = useForm({
    defaultValues: { name: '', description: '', eventType: '', startDate: '', endDate: '', location: '', province: '', maxCapacity: '' },
  });

  const openCreate = () => { reset(); setIsModalOpen(true); };
  const closeModal = () => {
    setIsModalOpen(false);
    if (searchParams.get('action')) router.replace('/dashboard/events');
  };

  const onSubmit = async (formData: Record<string, string>) => {
    try {
      await createMutation.mutateAsync({
        name: formData.name,
        description: formData.description || undefined,
        eventType: formData.eventType || undefined,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        location: formData.location || undefined,
        province: formData.province || undefined,
        maxCapacity: formData.maxCapacity ? parseInt(formData.maxCapacity) : undefined,
      });
      closeModal();
    } catch { /* toast */ }
  };

  const events = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Eventos"
        description="Gestión de eventos y capacitaciones"
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nuevo evento</Button>}
      />

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <SearchBar placeholder="Buscar evento..." onSearch={handleSearch} initialQuery={searchQuery} />
          </div>
          <div className="w-full sm:w-48">
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </Card>

      <Card className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" text="Cargando eventos..." /></div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-500">Error al cargar los eventos.</div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No hay eventos"
            description={searchQuery ? 'No se encontraron resultados.' : 'Comienza creando un nuevo evento.'}
            action={!searchQuery && <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nuevo evento</Button>}
          />
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Evento</TableHeaderCell>
                  <TableHeaderCell>Tipo</TableHeaderCell>
                  <TableHeaderCell>Fecha</TableHeaderCell>
                  <TableHeaderCell>Ubicación</TableHeaderCell>
                  <TableHeaderCell>Inscritos</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell align="right">Acciones</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <p className="font-medium text-gray-900">{event.name}</p>
                      {event.description && <p className="text-xs text-gray-400 truncate max-w-[250px]">{event.description}</p>}
                    </TableCell>
                    <TableCell>{event.eventType || '—'}</TableCell>
                    <TableCell>
                      {event.startDate ? (
                        <div className="text-sm">
                          <p>{formatDate(event.startDate)}</p>
                          {event.endDate && <p className="text-xs text-gray-400">al {formatDate(event.endDate)}</p>}
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{event.location || '—'}</p>
                        {event.province && (
                          <p className="text-xs text-gray-400">{provinciaNombre(event.province)}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <UsersIcon className="h-4 w-4 text-gray-400" />
                        <span>{event._count?.registrations ?? 0}</span>
                        {event.maxCapacity && <span className="text-gray-400">/ {event.maxCapacity}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant[event.status] || 'default'}>
                        {statusLabels[event.status] || event.status}
                      </Badge>
                    </TableCell>
                    <TableCell align="right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/events/${event.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {meta && meta.totalPages > 1 && (
              <div className="border-t p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Mostrando {(meta.page - 1) * meta.limit + 1} - {Math.min(meta.page * meta.limit, meta.total)} de {meta.total}
                  </p>
                  <Pagination currentPage={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Create Event Modal */}
      <Modal
        isOpen={isModalOpen} onClose={closeModal}
        title="Nuevo evento" description="Crear un nuevo evento o capacitación" size="lg"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)} isLoading={createMutation.isPending}>Crear evento</Button>
          </div>
        }
      >
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <div className="sm:col-span-2">
            <Input label="Nombre del evento *" error={formErrors.name?.message} {...register('name', { required: 'Requerido' })} />
          </div>
          <div className="sm:col-span-2">
            <Input label="Descripción" {...register('description')} />
          </div>
          <Select label="Tipo de evento" options={eventTypeOptions} {...register('eventType')} />
          <Input label="Capacidad máxima" type="number" {...register('maxCapacity')} />
          <Input label="Fecha inicio" type="date" {...register('startDate')} />
          <Input label="Fecha fin" type="date" {...register('endDate')} />
          <Input label="Ubicación" {...register('location')} />
          <Select label="Provincia" options={provinciaFormOptions} {...register('province')} />
        </form>
      </Modal>
    </div>
  );
}
