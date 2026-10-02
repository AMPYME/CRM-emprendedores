'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { SettingsNav } from '@/components/layout/settings-nav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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

const statusOptions = [
  { value: 'PENDING', label: 'Pendientes (sin confirmar)' },
  { value: 'CONFIRMED', label: 'Confirmadas' },
  { value: 'CANCELLED', label: 'Canceladas' },
  { value: 'ALL', label: 'Todas' },
];

const statusBadge: Record<string, 'warning' | 'success' | 'danger' | 'default'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  CANCELLED: 'danger',
};

const statusLabel: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickDocumento(source: Record<string, unknown> | null): string | null {
  if (!source) return null;
  for (const key of ['ruc', 'documentNumber', 'cedula'] as const) {
    const raw = source[key];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
  }
  return null;
}

/** Cédula o RUC de la entidad asociada a la solicitud de confirmación. */
function documentoDeConfirmacion(payload: unknown): string {
  const root = asRecord(payload);
  if (!root) return '—';

  const fromAfter = pickDocumento(asRecord(root.after));
  if (fromAfter) return fromAfter;

  const fromBefore = pickDocumento(asRecord(root.before));
  if (fromBefore) return fromBefore;

  const fromApply = pickDocumento(asRecord(root.apply));
  if (fromApply) return fromApply;

  return pickDocumento(root) || '—';
}

function displayUsername(row: {
  requestedBy?: { username: string | null; email: string; displayName: string } | null;
}): string {
  const u = row.requestedBy?.username?.trim();
  if (u) {
    return u.includes('@') ? u.split('@')[0] || u : u;
  }
  return row.requestedBy?.displayName || '—';
}

export default function MisConfirmacionesPage() {
  const [statusDraft, setStatusDraft] = useState<'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'ALL'>(
    'PENDING'
  );
  const [status, setStatus] = useState<'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'ALL'>('PENDING');
  const [page, setPage] = useState(1);

  const listQuery = useQuery({
    queryKey: ['my-change-requests', status, page],
    queryFn: () =>
      personChangesService.listMine({
        status,
        mineOnly: true,
        page,
        limit: 20,
      }),
  });

  function buscar() {
    setStatus(statusDraft);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis confirmaciones"
        description="Solicitudes de cambio abiertas por su usuario. Por defecto se listan las pendientes de confirmar."
      />
      <SettingsNav />

      <Card title="Filtros">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            buscar();
          }}
        >
          <div className="w-full sm:max-w-xs">
            <Select
              label="Estado"
              options={statusOptions}
              value={statusDraft}
              onChange={(e) =>
                setStatusDraft(e.target.value as 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'ALL')
              }
            />
          </div>
          <Button type="submit" isLoading={listQuery.isFetching}>
            Buscar
          </Button>
        </form>
      </Card>

      {listQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner text="Cargando solicitudes..." />
        </div>
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Resumen</TableHeaderCell>
                <TableHeaderCell>Estado</TableHeaderCell>
                <TableHeaderCell>Usuario</TableHeaderCell>
                <TableHeaderCell>Fecha</TableHeaderCell>
                <TableHeaderCell>Detalle</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(listQuery.data?.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <p className="text-sm text-slate-500">
                      No hay solicitudes con esos filtros.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                (listQuery.data?.data ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.summary || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadge[row.status] || 'default'}>
                        {statusLabel[row.status] || row.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-700">{displayUsername(row)}</span>
                    </TableCell>
                    <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <span className="font-mono text-sm text-slate-800">
                        {documentoDeConfirmacion(row.payload)}
                      </span>
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
