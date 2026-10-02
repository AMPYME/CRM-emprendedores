'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FolderKanban, Plus, Eye, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
import { personsService } from '@/services/persons.service';
import { adminService } from '@/services/admin.service';
import { usePagination } from '@/hooks/use-pagination';
import { formatDateShort } from '@/lib/utils';
import { portfolioCategoryOptions } from '@/lib/portfolio.constants';
import { useAuthStore } from '@/stores/auth.store';

const statusOptions = [
  { value: '', label: 'Activos (no resueltos)' },
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

function actEcDeEntidad(entity?: {
  actEc?: string | null;
  person?: { economicActivity?: string | null } | null;
  company?: { economicActivity?: string | null } | null;
} | null): string {
  return (
    entity?.actEc ||
    entity?.person?.economicActivity ||
    entity?.company?.economicActivity ||
    ''
  );
}

export default function PortfolioPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { page, limit, setPage } = usePagination();
  const [documento, setDocumento] = useState('');
  const [documentoBuscado, setDocumentoBuscado] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sedeFilter, setSedeFilter] = useState('');
  const [sedeReady, setSedeReady] = useState(false);
  const [departamentoFilter, setDepartamentoFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cedula, setCedula] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [entityLabel, setEntityLabel] = useState('');
  const [verifyMessage, setVerifyMessage] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (user?.sede?.id) {
      setSedeFilter(user.sede.id);
    }
    setSedeReady(true);
  }, [user?.sede?.id]);

  const { data, isLoading, error } = usePortfolios({
    page,
    limit,
    documento: documentoBuscado || undefined,
    status: statusFilter || undefined,
    excludeResolved: !statusFilter ? true : undefined,
    priority: priorityFilter || undefined,
    sedeId: sedeFilter || undefined,
    departamentoId: departamentoFilter || undefined,
  });

  const sedes = useQuery({ queryKey: ['sedes'], queryFn: adminService.listSedes });
  const departamentos = useQuery({ queryKey: ['departamentos'], queryFn: adminService.listDepartamentos });

  const sedeOptions = useMemo(
    () => [
      { value: '', label: 'Todas las sedes' },
      ...(sedes.data ?? []).map((sede) => ({ value: sede.id, label: sede.name })),
    ],
    [sedes.data]
  );
  const departamentoOptions = useMemo(
    () => [
      { value: '', label: 'Todos los departamentos' },
      ...(departamentos.data ?? []).map((item) => ({ value: item.id, label: item.name })),
    ],
    [departamentos.data]
  );

  const stats = usePortfolioStats();
  const createMutation = useCreatePortfolio();

  const { register, handleSubmit, reset, formState: { errors: formErrors } } = useForm<CreatePortfolioForm>({
    defaultValues: {
      subject: '',
      priority: 'MEDIUM',
      category: '',
      description: '',
      nextFollowUpDate: '',
    },
  });

  const handleBuscarDocumento = useCallback(() => {
    const value = documento.trim();
    setPage(1);
    setDocumentoBuscado(value || null);
  }, [documento, setPage]);

  const openCreate = () => {
    reset();
    setCedula('');
    setSelectedEntityId('');
    setEntityLabel('');
    setVerifyMessage('');
    setIsModalOpen(true);
  };

  const verifyCedula = async () => {
    const value = cedula.trim();
    if (!value) {
      setVerifyMessage('Ingrese una cédula.');
      setSelectedEntityId('');
      setEntityLabel('');
      return;
    }
    setVerifying(true);
    setVerifyMessage('');
    try {
      const entity = await personsService.lookupByCedula(value);
      setSelectedEntityId(entity.id);
      setEntityLabel(entity.displayName);
      setVerifyMessage('');
    } catch {
      setSelectedEntityId('');
      setEntityLabel('');
      setVerifyMessage('No existe una persona con esa cédula.');
    } finally {
      setVerifying(false);
    }
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
  const listLoading = isLoading || !sedeReady;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seguimiento"
        description="Gestión de casos y seguimiento de emprendedores"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Nuevo registro
          </Button>
        }
      />

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

      <Card>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleBuscarDocumento();
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-[16rem] flex-1">
              <Input
                label="Cédula o RUC"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder="8-123-456 o 155772663-2-2025"
                autoComplete="off"
              />
            </div>
            <Button type="submit">Buscar</Button>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="w-full sm:w-52">
              <Select options={statusOptions} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} />
            </div>
            <div className="w-full sm:w-44">
              <Select options={priorityOptions} value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }} />
            </div>
            <div className="w-full sm:w-52">
              <Select options={sedeOptions} value={sedeFilter} onChange={(e) => { setSedeFilter(e.target.value); setPage(1); }} />
            </div>
            <div className="w-full sm:w-56">
              <Select options={departamentoOptions} value={departamentoFilter} onChange={(e) => { setDepartamentoFilter(e.target.value); setPage(1); }} />
            </div>
          </div>
        </form>
      </Card>

      <Card className="p-0">
        {listLoading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" text="Cargando seguimiento..." /></div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-500">Error al cargar el seguimiento.</div>
        ) : records.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No hay registros de seguimiento"
            description={documentoBuscado ? 'No se encontraron resultados para ese documento.' : 'No hay seguimientos activos en la sede seleccionada.'}
            action={!documentoBuscado ? (
              <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                Nuevo registro
              </Button>
            ) : undefined}
          />
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Asunto</TableHeaderCell>
                  <TableHeaderCell>Entidad</TableHeaderCell>
                  <TableHeaderCell>Act. económica</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Prioridad</TableHeaderCell>
                  <TableHeaderCell>Asignado a</TableHeaderCell>
                  <TableHeaderCell>Próximo seguimiento</TableHeaderCell>
                  <TableHeaderCell align="right">Ver</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((record) => {
                  const isOverdue = record.nextFollowUpDate && new Date(record.nextFollowUpDate) < new Date();
                  const actEc = actEcDeEntidad(record.entity as Parameters<typeof actEcDeEntidad>[0]);
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
                        <p className="max-w-[12rem] truncate text-sm text-gray-700" title={actEc || undefined}>
                          {actEc || '—'}
                        </p>
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
                        {record.assignedTo ? (
                          <div className="flex flex-col gap-0.5 text-sm">
                            <span>{record.assignedTo.username || '—'}</span>
                            {record.sede?.name && (
                              <span className="text-gray-500">{record.sede.name}</span>
                            )}
                            {record.departamento?.name && (
                              <span className="text-gray-500">{record.departamento.name}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">Sin asignar</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.nextFollowUpDate ? (
                          <span className={isOverdue ? 'flex items-center gap-1 text-red-600 font-medium' : ''}>
                            {isOverdue && <AlertTriangle className="h-3 w-3" />}
                            {formatDateShort(record.nextFollowUpDate)}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
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
        title="Nuevo seguimiento"
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
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label="Cédula *"
                  placeholder="X-XXXX-XXXXX"
                  value={cedula}
                  onChange={(e) => {
                    setCedula(e.target.value);
                    setSelectedEntityId('');
                    setEntityLabel('');
                    setVerifyMessage('');
                  }}
                />
              </div>
              <Button type="button" variant="outline" onClick={verifyCedula} isLoading={verifying}>
                Verificar
              </Button>
            </div>
            {entityLabel && (
              <p className="mt-2 text-sm text-green-700">Persona encontrada: {entityLabel}</p>
            )}
            {verifyMessage && (
              <p className="mt-2 text-sm text-red-600">{verifyMessage}</p>
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
