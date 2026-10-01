'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/table';
import { personChangesService } from '@/services/person-changes.service';
import { getApiErrorMessage } from '@/services/api-client';
import { isReadOnlyRole } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth.store';
import { changeDiffRows, parseChangeDiff } from '@/lib/person-change-display';

function ChangeDetail({ payload, action }: { payload: unknown; action: string }) {
  const { before, after } = parseChangeDiff(payload, action);
  const rows = changeDiffRows(before, after);

  if (rows.length === 0) {
    return <span className="text-sm text-slate-500">Sin detalle de campos</span>;
  }

  return (
    <div className="min-w-[18rem] max-w-lg space-y-2">
      <div className="hidden grid-cols-[minmax(7rem,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b border-slate-200 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid">
        <span>Campo</span>
        <span>Dato anterior</span>
        <span>Dato nuevo</span>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[minmax(7rem,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-start sm:gap-2"
          >
            <p className="text-sm font-medium text-slate-800">{row.label}</p>
            <p className="text-sm text-slate-500">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:hidden">
                Dato anterior
              </span>
              {row.beforeText || <span className="text-slate-300">&nbsp;</span>}
            </p>
            <p className="rounded bg-emerald-50 px-1.5 py-0.5 text-sm text-emerald-800">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:hidden">
                Dato nuevo
              </span>
              {row.afterText || <span className="text-slate-300">&nbsp;</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ConfirmacionPage() {
  const { user } = useAuthStore();
  const readOnly = isReadOnlyRole(user?.role);
  const qc = useQueryClient();
  const [documento, setDocumento] = useState('');
  const [documentoBuscado, setDocumentoBuscado] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const listQuery = useQuery({
    queryKey: ['person-change-requests', documentoBuscado, page],
    queryFn: () =>
      personChangesService.listMine({
        status: 'PENDING',
        documento: documentoBuscado!,
        page,
        limit: 20,
      }),
    enabled: Boolean(documentoBuscado),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => personChangesService.confirm(id),
    onSuccess: () => {
      toast.success('Cambio confirmado y aplicado');
      qc.invalidateQueries({ queryKey: ['person-change-requests'] });
      qc.invalidateQueries({ queryKey: ['persons'] });
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['entity'] });
      qc.invalidateQueries({ queryKey: ['entity-historial'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err) || 'No se pudo confirmar'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => personChangesService.cancel(id),
    onSuccess: () => {
      toast.success('Solicitud cancelada');
      qc.invalidateQueries({ queryKey: ['person-change-requests'] });
      qc.invalidateQueries({ queryKey: ['entity-historial'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err) || 'No se pudo cancelar'),
  });

  function verificar() {
    const value = documento.trim();
    if (!value) {
      toast.error('Indique una cédula o un RUC.');
      return;
    }
    setPage(1);
    setDocumentoBuscado(value);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Confirmación"
        description="Busque por cédula o RUC para ver solo los cambios pendientes de aprobar de ese documento."
      />

      <Card title="Verificar documento">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            verificar();
          }}
        >
          <div className="flex-1">
            <Input
              label="Cédula o RUC"
              value={documento}
              onChange={(event) => setDocumento(event.target.value)}
              placeholder="8-123-456 o 155772663-2-2025"
              autoComplete="off"
            />
          </div>
          <Button type="submit" isLoading={listQuery.isFetching && Boolean(documentoBuscado)}>
            Verificar
          </Button>
        </form>
      </Card>

      {!documentoBuscado ? (
        <p className="text-sm text-slate-500">
          Escriba una cédula o un RUC y verifique para listar los cambios pendientes.
        </p>
      ) : listQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner text="Cargando solicitudes..." />
        </div>
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Resumen</TableHeaderCell>
                <TableHeaderCell>Fecha</TableHeaderCell>
                <TableHeaderCell>Detalle</TableHeaderCell>
                <TableHeaderCell>Operaciones</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(listQuery.data?.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <span className="text-sm text-slate-500">
                      No hay cambios pendientes por aprobar para ese documento.
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                (listQuery.data?.data ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.summary || '—'}</TableCell>
                    <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <ChangeDetail payload={row.payload} action={row.action} />
                    </TableCell>
                    <TableCell>
                      {!readOnly ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            size="sm"
                            isLoading={confirmMutation.isPending}
                            onClick={() => confirmMutation.mutate(row.id)}
                          >
                            Confirmar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            isLoading={cancelMutation.isPending}
                            onClick={() => cancelMutation.mutate(row.id)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {listQuery.data?.meta && listQuery.data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>
                Página {listQuery.data.meta.page} de {listQuery.data.meta.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!listQuery.data.meta.hasPrevPage}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!listQuery.data.meta.hasNextPage}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
