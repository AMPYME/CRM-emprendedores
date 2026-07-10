'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FolderKanban, Plus, Eye, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SearchBar } from '@/components/ui/search-bar';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Pagination } from '@/components/ui/pagination';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import {
  Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell,
} from '@/components/ui/table';
import { usePortfolios, usePortfolioStats, useCreatePortfolio } from '@/hooks/use-portfolio';
import { useEntities } from '@/hooks/use-entities';
import { usePagination } from '@/hooks/use-pagination';
import { formatDateShort } from '@/lib/utils';
import { provinciaNombre } from '@/lib/division-politica';
import { portfolioCategoryOptions } from '@/lib/portfolio.constants';

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'NEW', label: 'Nuevo' },
  { value: 'IN_PROGRESS', label: 'En progreso' },
  { value: 'WAITING', label: 'En espera' },
  { value: 'RESOLVED', label: 'Resuelto' },
  { value: 'CLOSED', label: 'Cerrado' },
];

const priorityOptions = [
  { value: '', label: 'Todas las prioridades' },
  { value: 'LOW', label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
];

const createPriorityOptions = priorityOptions.filter((o) => o.value !== '');

const statusBadge: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
  NEW: 'primary',
  IN_PROGRESS: 'warning',
  WAITING: 'default',
  RESOLVED: 'success',
  CLOSED: 'default',
};

const priorityBadge: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
  LOW: 'default',
  MEDIUM: 'primary',
  HIGH: 'warning',
  URGENT: 'danger',
};

const statusLabel: Record<string, string> = {
  NEW: 'Nuevo', IN_PROGRESS: 'En progreso', WAITING: 'En espera',
  RESOLVED: 'Resuelto', CLOSED: 'Cerrado',
};

const priorityLabel: Record<string, string> = {
  LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', URGENT: 'Urgente',
};

interface CreatePortfolioForm {
  subject: string;
  priority: string;
  category: string;
  description: string;
  nextFollowUpDate: string;
}

export default function PortfolioPage() {
  const router = useRouter();
  const { page, limit, setPage, searchQuery, setSearchQuery } = usePagination();
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entitySearch, setEntitySearch] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState('');

  const { data, isLoading, error } = usePortfolios({
    page, limit,
    search: searchQuery || undefined,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
  });

  const stats = usePortfolioStats();
  const createMutation = useCreatePortfolio();
  const entities = useEntities({ search: entitySearch || undefined, limit: 10 });

  const { register, handleSubmit, reset, formState: { errors: formErrors } } = useForm<CreatePortfolioForm>({
    defaultValues: {
      subject: '',
      priority: 'MEDIUM',
      category: '',
      description: '',
      nextFollowUpDate: '',
    },
  });

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setPage(1);
  }, [setSearchQuery, setPage]);

  const openCreate = () => {
    reset();
    setEntitySearch('');
    setSelectedEntityId('');
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const onSubmit = async (formData: CreatePortfolioForm) => {
    if (!selectedEntityId) return;
    try {
      const record = await createMutation.mutateAsync({
        entityId: selectedEntityId,
        subject: formData.subject,
        priority: formData.priority || undefined,
        category: formData.category || undefined,
        description: formData.description || undefined,
        nextFollowUpDate: formData.nextFollowUpDate || undefined,
      });
      closeModal();
      router.push(`/dashboard/portfolio/${record.id}`);
    } catch { /* toast */ }
  };

  const records = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cartera de Seguimiento"
        description="Gestión de casos y seguimiento de emprendedores"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Nuevo registro
          </Button>
        }
      />

      {/* Quick stats */}
      {stats.data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="text-center">
            <p className="text-3xl font-bold text-gray-900">{stats.data.total}</p>
            <p className="text-xs text-gray-500">Total registros</p>
          </Card>
          <Card className="text-center">
            <p className="text-3xl font-bold text-red-600">{stats.data.overdue}</p>
            <p className="text-xs text-gray-500">Vencidos</p>
          </Card>
          <Card className="text-center">
            <p className="text-3xl font-bold text-yellow-600">{stats.data.upcoming}</p>
            <p className="text-xs text-gray-500">Próximos</p>
          </Card>
          <Card className="text-center">
            <p className="text-3xl font-bold text-blue-600">{stats.data.unmanaged}</p>
            <p className="text-xs text-gray-500">Sin gestión</p>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <SearchBar placeholder="Buscar por asunto, entidad..." onSearch={handleSearch} initialQuery={searchQuery} />
          </div>
          <div className="w-full sm:w-44">
            <Select options={statusOptions} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} />
          </div>
          <div className="w-full sm:w-44">
            <Select options={priorityOptions} value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }} />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" text="Cargando cartera..." /></div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-500">Error al cargar la cartera.</div>
        ) : records.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No hay registros en cartera"
            description={searchQuery ? 'No se encontraron resultados.' : 'Comienza creando un nuevo registro de seguimiento.'}
            action={!searchQuery && (
              <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                Nuevo registro
              </Button>
            )}
          />
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Asunto</TableHeaderCell>
                  <TableHeaderCell>Entidad</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Prioridad</TableHeaderCell>
                  <TableHeaderCell>Asignado a</TableHeaderCell>
                  <TableHeaderCell>Próximo seguimiento</TableHeaderCell>
                  <TableHeaderCell>Acciones</TableHeaderCell>
                  <TableHeaderCell align="right">Ver</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((record) => {
                  const isOverdue = record.nextFollowUpDate && new Date(record.nextFollowUpDate) < new Date();
                  return (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-gray-900">{record.subject}</p>
                          {record.category && <p className="text-xs text-gray-400">{record.category}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{record.entity?.displayName || '—'}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadge[record.status] || 'default'}>
                          {statusLabel[record.status] || record.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={priorityBadge[record.priority] || 'default'}>
                          {priorityLabel[record.priority] || record.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record.assignedTo
                          ? `${record.assignedTo.firstName} ${record.assignedTo.lastName}`
                          : <span className="text-gray-400">Sin asignar</span>
                        }
                      </TableCell>
                      <TableCell>
                        {record.nextFollowUpDate ? (
                          <span className={isOverdue ? 'flex items-center gap-1 text-red-600 font-medium' : ''}>
                            {isOverdue && <AlertTriangle className="h-3 w-3" />}
                            {formatDateShort(record.nextFollowUpDate)}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-500">{record._count?.actions ?? 0}</span>
                      </TableCell>
                      <TableCell align="right">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/portfolio/${record.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
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

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title="Nuevo registro de cartera"
        description="Crear un caso de seguimiento vinculado a un emprendedor"
        size="lg"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button
              onClick={handleSubmit(onSubmit)}
              isLoading={createMutation.isPending}
              disabled={!selectedEntityId}
            >
              Crear registro
            </Button>
          </div>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <Input
              label="Buscar entidad *"
              placeholder="Nombre, cédula o RUC..."
              value={entitySearch}
              onChange={(e) => {
                setEntitySearch(e.target.value);
                setSelectedEntityId('');
              }}
            />
            {entities.data && (
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
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
                      <p className="text-xs text-gray-400">
                        {ent.entityType} · {provinciaNombre(ent.province) || 'Sin provincia'}
                      </p>
                    </button>
                  ))
                )}
              </div>
            )}
            {entities.isLoading && <LoadingSpinner size="sm" text="Buscando..." />}
            {!selectedEntityId && entitySearch && !entities.isLoading && (
              <p className="mt-1 text-xs text-gray-500">Selecciona una entidad de la lista.</p>
            )}
          </div>

          <Input
            label="Asunto *"
            placeholder="Motivo del seguimiento..."
            error={formErrors.subject?.message}
            {...register('subject', { required: 'Requerido' })}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Prioridad"
              options={createPriorityOptions}
              {...register('priority')}
            />
            <Select
              label="Categoría"
              options={portfolioCategoryOptions}
              {...register('category')}
            />
          </div>

          <Input
            label="Próximo seguimiento"
            type="date"
            {...register('nextFollowUpDate')}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Descripción</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              rows={3}
              placeholder="Detalles del caso..."
              {...register('description')}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
