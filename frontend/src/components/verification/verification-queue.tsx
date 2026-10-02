'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, Trash2, Unlock } from 'lucide-react';
import {
  useVerifications,
  useClaimVerification,
  useReleaseVerification,
  useReleaseAllVerifications,
  useDeleteVerification,
} from '@/hooks/use-verifications';
import { useVerificationQueueStream } from '@/hooks/use-verification-queue-stream';
import { usePagination } from '@/hooks/use-pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { SearchBar } from '@/components/ui/search-bar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { ConfirmDialog } from '@/components/ui/modal';
import {
  Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell,
} from '@/components/ui/table';
import {
  getProvinciaOptions,
  getDistritoOptions,
  getCorregimientoOptions,
  provinciaNombre,
  distritoNombre,
  corregimientoNombre,
} from '@/lib/division-politica';
import { getApiErrorMessage } from '@/services/api-client';
import { intakeAccessCodeKey } from '@/services/intake.service';
import type { VerificationListItem } from '@/services/verification.service';
import { useAuthStore } from '@/stores/auth.store';
import { isFullAccessRole } from '@/lib/roles';

const sourceOptions = [
  { value: '', label: 'Todos los orígenes' },
  { value: 'IMPORT', label: 'Importados' },
  { value: 'FIELD', label: 'Captura en campo' },
];

const assignmentOptions = [
  { value: 'all', label: 'Todas las asignaciones' },
  { value: 'unassigned', label: 'Sin asignar' },
  { value: 'mine', label: 'Asignados a mí' },
  { value: 'others', label: 'Asignados a otros' },
];

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'ASSIGNED', label: 'Asignado' },
  { value: 'IN_REVIEW', label: 'En revisión' },
  { value: 'VALIDATED', label: 'Validado' },
  { value: 'REJECTED', label: 'Rechazado' },
];

const entityTypeOptions = [
  { value: '', label: 'Todos los tipos' },
  { value: 'PERSON', label: 'Persona' },
  { value: 'COMPANY', label: 'Empresa' },
];

const sourceBadge = {
  IMPORT: { label: 'IMPORTADO', variant: 'primary' as const },
  FIELD: { label: 'CAPTURA EN CAMPO', variant: 'purple' as const },
};

const statusBadge: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'default',
  ASSIGNED: 'info',
  IN_REVIEW: 'warning',
  VALIDATED: 'success',
  REJECTED: 'danger',
};

const statusLabel: Record<string, string> = {
  PENDING: 'Pendiente',
  ASSIGNED: 'Asignado',
  IN_REVIEW: 'En revisión',
  VALIDATED: 'Validado',
  REJECTED: 'Rechazado',
};

function formatDate(d: string) {
  return new Intl.DateTimeFormat('es-PA', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(d));
}

function remainingLabel(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expirada';
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}m ${sec.toString().padStart(2, '0')}s`;
}

export function VerificationQueuePanel() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = isFullAccessRole(user?.role);
  const { page, limit, setPage, searchQuery, setSearchQuery } = usePagination({ initialLimit: 30 });
  const [source, setSource] = useState('');
  const [assignment, setAssignment] = useState('all');
  const [status, setStatus] = useState('');
  const [entityType, setEntityType] = useState('');
  const [provinceId, setProvinceId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [corregimientoId, setCorregimientoId] = useState('');
  const [releaseAllOpen, setReleaseAllOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VerificationListItem | null>(null);

  const claimMutation = useClaimVerification();
  const releaseMutation = useReleaseVerification();
  const releaseAllMutation = useReleaseAllVerifications();
  const deleteMutation = useDeleteVerification();

  useVerificationQueueStream(true);

  const { data, isLoading, error, refetch } = useVerifications({
    page,
    limit,
    search: searchQuery || undefined,
    source: (source || undefined) as 'IMPORT' | 'FIELD' | undefined,
    assignment: (assignment || 'all') as 'all' | 'unassigned' | 'mine' | 'others',
    status: (status || undefined) as 'PENDING' | 'ASSIGNED' | 'IN_REVIEW' | 'VALIDATED' | 'REJECTED' | undefined,
    entityType: (entityType || undefined) as 'PERSON' | 'COMPANY' | undefined,
    provinceId: provinceId || undefined,
    districtId: districtId || undefined,
    corregimientoId: corregimientoId || undefined,
  });

  const items = data?.data ?? [];
  const meta = data?.meta;

  const handleClaim = async (item: VerificationListItem) => {
    try {
      const result = await claimMutation.mutateAsync(item.id);
      if (result.intakeSessionId) {
        if (result.accessCode) {
          sessionStorage.setItem(intakeAccessCodeKey(result.intakeSessionId), result.accessCode);
        }
        router.push(`/dashboard/intake/${result.intakeSessionId}?verificationId=${item.id}`);
      }
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: { code?: string } } } }).response?.data
        ?.error?.code;
      if (code === 'VERIFICATION_ALREADY_ASSIGNED') {
        alert('Este registro ya fue asignado a otro funcionario.');
        refetch();
      } else {
        alert(getApiErrorMessage(err));
      }
    }
  };

  const handleRelease = async (item: VerificationListItem) => {
    if (!window.confirm('¿Liberar esta asignación para que otro funcionario pueda tomarla?')) return;
    await releaseMutation.mutateAsync(item.id);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      setDeleteTarget(null);
    }
  };

  const provinciaOpts = [{ value: '', label: 'Todas las provincias' }, ...getProvinciaOptions().filter((o) => o.value)];
  const distritoOpts = [
    { value: '', label: 'Todos los distritos' },
    ...(provinceId ? getDistritoOptions(provinceId).filter((o) => o.value) : []),
  ];
  const corrOpts = [
    { value: '', label: 'Todos los corregimientos' },
    ...(districtId && provinceId ? getCorregimientoOptions(provinceId, districtId).filter((o) => o.value) : []),
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Los registros importados asignados expiran a los <strong>30 minutos sin guardar cambios</strong>.
        Ver la cola en vivo no cuenta como actividad. En captura en campo el plazo es el del enlace o código.
        Esta cola se actualiza sola.
      </p>
      {isAdmin && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            icon={<Unlock className="h-4 w-4" />}
            onClick={() => setReleaseAllOpen(true)}
            isLoading={releaseAllMutation.isPending}
          >
            Liberar todas las asignaciones
          </Button>
        </div>
      )}
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SearchBar
            value={searchQuery}
            onSearch={(q) => { setSearchQuery(q); setPage(1); }}
            placeholder="Nombre, cédula, RUC..."
          />
          <Select options={sourceOptions} value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} />
          <Select options={assignmentOptions} value={assignment} onChange={(e) => { setAssignment(e.target.value); setPage(1); }} />
          <Select options={statusOptions} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} />
          <Select options={entityTypeOptions} value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} />
          <Select
            options={provinciaOpts}
            value={provinceId}
            onChange={(e) => {
              setProvinceId(e.target.value);
              setDistrictId('');
              setCorregimientoId('');
              setPage(1);
            }}
          />
          <Select
            options={distritoOpts}
            value={districtId}
            disabled={!provinceId}
            onChange={(e) => {
              setDistrictId(e.target.value);
              setCorregimientoId('');
              setPage(1);
            }}
          />
          <Select
            options={corrOpts}
            value={corregimientoId}
            disabled={!districtId}
            onChange={(e) => { setCorregimientoId(e.target.value); setPage(1); }}
          />
        </div>
      </Card>

      <Card className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-16"><LoadingSpinner size="lg" text="Cargando cola..." /></div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-500">Error al cargar la cola de verificación.</div>
        ) : items.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="Cola vacía" description="No hay registros pendientes con estos filtros." />
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nombre / Razón social</TableHeaderCell>
                  <TableHeaderCell>Identificación</TableHeaderCell>
                  <TableHeaderCell>Tipo</TableHeaderCell>
                  <TableHeaderCell>Origen</TableHeaderCell>
                  <TableHeaderCell>Ubicación</TableHeaderCell>
                  <TableHeaderCell>Importación</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Asignado</TableHeaderCell>
                  <TableHeaderCell>Fecha</TableHeaderCell>
                  <TableHeaderCell>Acciones</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => {
                  const src = sourceBadge[item.source];
                  return (
                    <TableRow key={item.id}>
                      <TableCell><span className="font-medium">{item.displayName || '—'}</span></TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {item.searchCedula || item.searchRuc || '—'}
                        </span>
                      </TableCell>
                      <TableCell>{item.entityType === 'PERSON' ? 'Persona' : 'Empresa'}</TableCell>
                      <TableCell><Badge variant={src.variant}>{src.label}</Badge></TableCell>
                      <TableCell>
                        <span className="text-xs text-gray-500">
                          {[item.province && provinciaNombre(item.province), item.district && distritoNombre(item.province, item.district), item.corregimiento && corregimientoNombre(item.province, item.district, item.corregimiento)].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </TableCell>
                      <TableCell><span className="text-xs">{item.importFileName || '—'}</span></TableCell>
                      <TableCell><Badge variant={statusBadge[item.status] || 'default'}>{statusLabel[item.status] || item.status}</Badge></TableCell>
                      <TableCell><span className="text-sm">{item.assignedToName || '—'}</span></TableCell>
                      <TableCell>
                        <span className="text-xs text-gray-500">{formatDate(item.createdAt)}</span>
                        {item.source === 'IMPORT' && item.assignedToId && item.assignmentExpiresAt && (
                          <p className="text-[11px] text-amber-700">
                            Libera en {remainingLabel(item.assignmentExpiresAt)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {['PENDING', 'ASSIGNED', 'IN_REVIEW'].includes(item.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              isLoading={claimMutation.isPending}
                              onClick={() => handleClaim(item)}
                            >
                              Verificar
                            </Button>
                          )}
                          {['ASSIGNED', 'IN_REVIEW'].includes(item.status) && item.assignedToId && (
                            (item.assignedToId === user?.id || isAdmin) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-amber-700"
                                isLoading={releaseMutation.isPending}
                                onClick={() => handleRelease(item)}
                              >
                                Liberar asignación
                              </Button>
                            )
                          )}
                          {item.status !== 'VALIDATED' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Eliminar de la cola"
                              className="text-red-600"
                              onClick={() => setDeleteTarget(item)}
                              icon={<Trash2 className="h-4 w-4" />}
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {meta && meta.totalPages > 1 && (
              <div className="border-t p-4">
                <Pagination currentPage={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </Card>

      <ConfirmDialog
        isOpen={releaseAllOpen}
        onClose={() => setReleaseAllOpen(false)}
        onConfirm={() => {
          setReleaseAllOpen(false);
          releaseAllMutation.mutate();
        }}
        title="Liberar todas las asignaciones"
        message="Todos los registros en verificación volverán a la cola sin asignar. Las sesiones de intake abiertas se cerrarán."
        confirmLabel="Liberar todas"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar de la cola"
        message={`Se eliminará "${deleteTarget?.displayName || 'este registro'}" de la cola de verificación. Esta acción no borra datos ya validados en el padrón.`}
        confirmLabel="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
