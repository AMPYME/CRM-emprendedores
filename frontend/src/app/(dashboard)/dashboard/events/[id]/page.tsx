'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Calendar, Users, MapPin, Clock, Plus, Edit, CheckCircle,
  XCircle, UserCheck, UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import {
  Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell,
} from '@/components/ui/table';
import {
  useEvent, useUpdateEvent, useEventRegistrations, useCreateRegistration,
} from '@/hooks/use-events';
import { useEntities } from '@/hooks/use-entities';
import { usePagination } from '@/hooks/use-pagination';
import { formatDate, formatDateShort } from '@/lib/utils';
import type { EventStatus, RegistrationStatus } from '@/types/entities.types';

const statusBadge: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'default', PUBLISHED: 'primary', IN_PROGRESS: 'warning',
  COMPLETED: 'success', CANCELLED: 'danger',
};
const statusLabel: Record<string, string> = {
  DRAFT: 'Borrador', PUBLISHED: 'Publicado', IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completado', CANCELLED: 'Cancelado',
};
const regStatusBadge: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
  REGISTERED: 'default', CONFIRMED: 'primary', ATTENDED: 'success',
  NO_SHOW: 'danger', CANCELLED: 'warning',
};
const regStatusLabel: Record<string, string> = {
  REGISTERED: 'Registrado', CONFIRMED: 'Confirmado', ATTENDED: 'Asistió',
  NO_SHOW: 'No asistió', CANCELLED: 'Cancelado',
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: event, isLoading, error } = useEvent(id);
  const updateMutation = useUpdateEvent();

  const [activeTab, setActiveTab] = useState('info');
  const { page, limit, setPage } = usePagination();
  const regs = useEventRegistrations(id, { page, limit });

  // Registration modal
  const [addRegOpen, setAddRegOpen] = useState(false);
  const [entitySearch, setEntitySearch] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const entities = useEntities({ search: entitySearch || undefined, limit: 10 });
  const createReg = useCreateRegistration();

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', description: '', eventType: '', startDate: '', endDate: '',
    location: '', province: '', maxCapacity: '',
  });

  const openEdit = () => {
    if (!event) return;
    setEditForm({
      name: event.name,
      description: event.description || '',
      eventType: event.eventType || '',
      startDate: event.startDate ? event.startDate.slice(0, 10) : '',
      endDate: event.endDate ? event.endDate.slice(0, 10) : '',
      location: event.location || '',
      province: event.province || '',
      maxCapacity: event.maxCapacity?.toString() || '',
    });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!event) return;
    try {
      await updateMutation.mutateAsync({
        id: event.id,
        data: {
          name: editForm.name,
          description: editForm.description || undefined,
          eventType: editForm.eventType || undefined,
          startDate: editForm.startDate || undefined,
          endDate: editForm.endDate || undefined,
          location: editForm.location || undefined,
          province: editForm.province || undefined,
          maxCapacity: editForm.maxCapacity ? parseInt(editForm.maxCapacity) : undefined,
        },
      });
      setEditOpen(false);
    } catch { /* toast */ }
  };

  const handleAddRegistration = async () => {
    if (!selectedEntityId || !id) return;
    try {
      await createReg.mutateAsync({ eventId: id, data: { entityId: selectedEntityId } });
      setAddRegOpen(false);
      setSelectedEntityId('');
      setEntitySearch('');
    } catch { /* toast */ }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" text="Cargando evento..." /></div>;
  }

  if (error || !event) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-red-500">No se pudo cargar el evento.</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/events')}>Volver</Button>
      </div>
    );
  }

  const tabs = [
    { id: 'info', label: 'Información', icon: <Calendar className="h-4 w-4" /> },
    { id: 'registrations', label: 'Inscripciones', icon: <Users className="h-4 w-4" />, count: event._count?.registrations },
  ];

  const registrations = regs.data?.data ?? [];
  const regMeta = regs.data?.meta;
  const capacity = event.maxCapacity;
  const registered = event._count?.registrations ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
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
              <h1 className="text-2xl font-bold text-gray-900 truncate">{event.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={statusBadge[event.status] || 'default'}>
                  {statusLabel[event.status] || event.status}
                </Badge>
                {event.eventType && <span className="text-xs text-gray-400">{event.eventType}</span>}
              </div>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" icon={<Edit className="h-4 w-4" />} onClick={openEdit}>
          Editar
        </Button>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* ── INFO TAB ─────────────────────────────── */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card title="Detalles del evento">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <InfoRow label="Nombre" value={event.name} span2 />
                <InfoRow label="Descripción" value={event.description} span2 />
                <InfoRow label="Tipo" value={event.eventType} />
                <InfoRow label="Ubicación" value={event.location} />
                <InfoRow label="Provincia" value={event.province} />
                <InfoRow label="Capacidad máxima" value={capacity} />
                <InfoRow label="Fecha inicio" value={event.startDate ? formatDate(event.startDate) : null} />
                <InfoRow label="Fecha fin" value={event.endDate ? formatDate(event.endDate) : null} />
                <InfoRow label="Creado" value={formatDate(event.createdAt)} />
              </dl>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <div className="text-center">
                <Users className="mx-auto h-8 w-8 text-blue-500 mb-2" />
                <p className="text-3xl font-bold text-gray-900">{registered}</p>
                <p className="text-sm text-gray-500">
                  {capacity ? `de ${capacity} cupos` : 'inscritos'}
                </p>
                {capacity && (
                  <div className="mt-3 h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.min(100, (registered / capacity) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </Card>
            <Card>
              <div className="text-center space-y-2">
                {event.startDate && (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span>{formatDateShort(event.startDate)}</span>
                  </div>
                )}
                {event.location && (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span>{event.location}</span>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── REGISTRATIONS TAB ────────────────────── */}
      {activeTab === 'registrations' && (
        <Card
          title="Inscripciones"
          description={`${registered} inscripciones registradas`}
        >
          <div className="mb-4 flex justify-end">
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAddRegOpen(true)}>
              Agregar inscripción
            </Button>
          </div>

          {regs.isLoading ? (
            <LoadingSpinner text="Cargando inscripciones..." />
          ) : registrations.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Sin inscripciones"
              description="No hay personas inscritas a este evento."
              action={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAddRegOpen(true)}>Agregar</Button>}
            />
          ) : (
            <>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Entidad</TableHeaderCell>
                    <TableHeaderCell>Estado</TableHeaderCell>
                    <TableHeaderCell>Fecha de registro</TableHeaderCell>
                    <TableHeaderCell>Asistencia</TableHeaderCell>
                    <TableHeaderCell>Notas</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {registrations.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell>
                        <p className="font-medium text-gray-900">
                          {reg.entity?.displayName || '—'}
                        </p>
                        <p className="text-xs text-gray-400">{reg.entity?.entityType}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={regStatusBadge[reg.status] || 'default'}>
                          {regStatusLabel[reg.status] || reg.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateShort(reg.registeredAt || reg.createdAt)}</TableCell>
                      <TableCell>
                        {reg.attendedAt ? (
                          <span className="flex items-center gap-1 text-green-600 text-sm">
                            <UserCheck className="h-4 w-4" /> Asistió
                          </span>
                        ) : reg.status === 'NO_SHOW' ? (
                          <span className="flex items-center gap-1 text-red-500 text-sm">
                            <UserX className="h-4 w-4" /> No asistió
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">Pendiente</span>
                        )}
                      </TableCell>
                      <TableCell>{reg.notes || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {regMeta && regMeta.totalPages > 1 && (
                <div className="border-t p-4 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    {(regMeta.page - 1) * regMeta.limit + 1} - {Math.min(regMeta.page * regMeta.limit, regMeta.total)} de {regMeta.total}
                  </p>
                  <Pagination currentPage={regMeta.page} totalPages={regMeta.totalPages} onPageChange={setPage} />
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* ── Edit Modal ───────────────────────────── */}
      <Modal
        isOpen={editOpen} onClose={() => setEditOpen(false)}
        title="Editar evento" size="lg"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdate} isLoading={updateMutation.isPending}>Guardar</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input label="Nombre *" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <Input label="Descripción" value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} />
          </div>
          <Input label="Tipo" value={editForm.eventType} onChange={(e) => setEditForm((p) => ({ ...p, eventType: e.target.value }))} />
          <Input label="Capacidad máxima" type="number" value={editForm.maxCapacity} onChange={(e) => setEditForm((p) => ({ ...p, maxCapacity: e.target.value }))} />
          <Input label="Fecha inicio" type="date" value={editForm.startDate} onChange={(e) => setEditForm((p) => ({ ...p, startDate: e.target.value }))} />
          <Input label="Fecha fin" type="date" value={editForm.endDate} onChange={(e) => setEditForm((p) => ({ ...p, endDate: e.target.value }))} />
          <Input label="Ubicación" value={editForm.location} onChange={(e) => setEditForm((p) => ({ ...p, location: e.target.value }))} />
          <Input label="Provincia" value={editForm.province} onChange={(e) => setEditForm((p) => ({ ...p, province: e.target.value }))} />
        </div>
      </Modal>

      {/* ── Add Registration Modal ───────────────── */}
      <Modal
        isOpen={addRegOpen} onClose={() => setAddRegOpen(false)}
        title="Agregar inscripción" size="md"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAddRegOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddRegistration} isLoading={createReg.isPending} disabled={!selectedEntityId}>
              Inscribir
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Buscar entidad"
            placeholder="Nombre, cédula o RUC..."
            value={entitySearch}
            onChange={(e) => { setEntitySearch(e.target.value); setSelectedEntityId(''); }}
          />
          {entities.data && (
            <div className="max-h-60 space-y-1 overflow-y-auto rounded-lg border p-2">
              {entities.data.data.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-400">Sin resultados</p>
              ) : (
                entities.data.data.map((ent) => (
                  <button
                    key={ent.id}
                    type="button"
                    className={`w-full rounded-lg p-2 text-left text-sm transition hover:bg-gray-100 ${
                      selectedEntityId === ent.id ? 'bg-primary-50 ring-1 ring-primary-500' : ''
                    }`}
                    onClick={() => setSelectedEntityId(ent.id)}
                  >
                    <p className="font-medium text-gray-900">{ent.displayName}</p>
                    <p className="text-xs text-gray-400">{ent.entityType} · {ent.province || 'Sin provincia'}</p>
                  </button>
                ))
              )}
            </div>
          )}
          {entities.isLoading && <LoadingSpinner size="sm" text="Buscando..." />}
        </div>
      </Modal>
    </div>
  );
}

function InfoRow({ label, value, span2 }: { label: string; value: string | number | null | undefined; span2?: boolean }) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <dt className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-gray-900">
        {value !== null && value !== undefined && value !== '' ? value : <span className="text-gray-300">—</span>}
      </dd>
    </div>
  );
}
