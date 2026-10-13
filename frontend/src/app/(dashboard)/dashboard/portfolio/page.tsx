'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FolderKanban, Plus, Eye, AlertTriangle, Download } from 'lucide-react';
import toast from 'react-hot-toast';
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
import { portfolioService } from '@/services/portfolio.service';
import { getApiErrorMessage } from '@/services/api-client';
import { adminService } from '@/services/admin.service';
import { usePagination } from '@/hooks/use-pagination';
import { formatDateShortOnly, toDateOnlyString } from '@/lib/utils';
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

const statusBadge: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
  NEW: 'primary',
  IN_PROGRESS: 'warning',
  WAITING: 'default',
  RESOLVED: 'success',
  CLOSED: 'default',
};

const statusLabel: Record<string, string> = {
  NEW: 'Nuevo', IN_PROGRESS: 'En progreso', WAITING: 'En espera',
  RESOLVED: 'Resuelto', CLOSED: 'Cerrado',
};

function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

interface CreatePortfolioForm {
  subject: string;
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
  const [exportFrom, setExportFrom] = useState(() => {
    const now = new Date();
    return isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [exportTo, setExportTo] = useState(() => isoDate(new Date()));
  const [exporting, setExporting] = useState(false);

  const downloadExcel = async () => {
    if (!user?.sede?.id) return;
    setExporting(true);
    try {
      await portfolioService.downloadBySede(exportFrom, exportTo);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const { register, handleSubmit, reset, formState: { errors: formErrors } } = useForm<CreatePortfolioForm>({
    defaultValues: {
      subject: '',
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
        className="mb-2 sm:mb-4"
        actions={
          <div className="mb-4 flex flex-col items-stretch gap-2 pb-2 sm:mb-6 sm:items-end sm:pb-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs font-medium text-gray-600">
                Desde
                <input
                  type="date"
                  value={exportFrom}
                  onChange={(event) => setExportFrom(event.target.value)}
                  className="mt-1 block h-9 rounded-lg border border-gray-300 px-2 text-sm text-gray-900"
                />
              </label>
              <label className="text-xs font-medium text-gray-600">
                Hasta
                <input
                  type="date"
                  value={exportTo}
                  onChange={(event) => setExportTo(event.target.value)}
                  className="mt-1 block h-9 rounded-lg border border-gray-300 px-2 text-sm text-gray-900"
                />
              </label>
              <Button
                variant="outline"
                icon={<Download className="h-4 w-4" />}
                onClick={downloadExcel}
                isLoading={exporting}
                disabled={!user?.sede?.id}
              >
                Descargar Excel
              </Button>
              <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                Nuevo Seguimiento
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              {user?.sede?.name
                ? `El Excel incluye los seguimientos de ${user.sede.name}, según la fecha en que se crearon.`
                : 'Tu usuario no tiene una sede asignada, así que no puede descargar el Excel.'}
            </p>
          </div>
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
                  <TableHeaderCell>Asignado a</TableHeaderCell>
                  <TableHeaderCell>Próximo seguimiento</TableHeaderCell>
                  <TableHeaderCell align="right">Ver</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((record) => {
                  const followUpYmd = record.nextFollowUpDate
                    ? toDateOnlyString(record.nextFollowUpDate)
                    : '';
                  const isOverdue = Boolean(followUpYmd && followUpYmd < toDateOnlyString(new Date()));
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
                        {record.assignedTo ? (
                          <div className="flex flex-col gap-0.5 text-sm">
                            <span>{record.assignedTo.username || '—'}</span>
                            {record.departamento?.name && (
                              <span className="text-gray-500">{record.departamento.name}</span>
                            )}
                            {record.sede?.name && (
                              <span className="text-gray-500">{record.sede.name}</span>
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
                            {formatDateShortOnly(record.nextFollowUpDate)}
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

          <Select
            label="Categoría"
            options={portfolioCategoryOptions}
            {...register('category')}
          />

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
