'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Pagination } from '@/components/ui/pagination';
import {
  Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell,
} from '@/components/ui/table';
import { usePagination } from '@/hooks/use-pagination';
import { useAuthStore } from '@/stores/auth.store';
import { canViewAudit } from '@/lib/roles';
import { auditService, type AuditAction } from '@/services/audit.service';

const actionOptions = [
  { value: '', label: 'Todas las acciones' },
  { value: 'CREATE', label: 'Creación' },
  { value: 'UPDATE', label: 'Actualización' },
  { value: 'DELETE', label: 'Eliminación' },
  { value: 'LOGIN', label: 'Inicio de sesión' },
  { value: 'VERIFICATION_CLAIM', label: 'Toma de verificación' },
  { value: 'VERIFICATION_UPDATE', label: 'Actualización de verificación' },
  { value: 'VERIFICATION_VALIDATE', label: 'Validación' },
  { value: 'VERIFICATION_REJECT', label: 'Rechazo' },
];

const actionLabel: Record<string, string> = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  LOGIN: 'Inicio de sesión',
  VERIFICATION_CLAIM: 'Toma de verificación',
  VERIFICATION_UPDATE: 'Actualización de verificación',
  VERIFICATION_VALIDATE: 'Validación',
  VERIFICATION_REJECT: 'Rechazo',
};

const actionBadge: Record<string, 'success' | 'primary' | 'danger' | 'info' | 'default'> = {
  CREATE: 'success',
  UPDATE: 'primary',
  DELETE: 'danger',
  LOGIN: 'info',
  VERIFICATION_CLAIM: 'info',
  VERIFICATION_UPDATE: 'primary',
  VERIFICATION_VALIDATE: 'success',
  VERIFICATION_REJECT: 'danger',
};

const entityTypeLabel: Record<string, string> = {
  PERSON: 'Persona',
  COMPANY: 'Empresa',
  USER: 'Usuario',
  PORTFOLIO: 'Cartera',
  VERIFICATION: 'Verificación',
  IMPORT_BATCH: 'Importación',
};

function formatAuditAction(action: string): string {
  if (actionLabel[action]) return actionLabel[action];
  return action
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatEntityType(entityType: string | null): string {
  if (!entityType) return 'Sistema';
  return entityTypeLabel[entityType] || entityType;
}

function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat('es-PA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export default function AuditPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { page, limit, setPage } = usePagination({ initialLimit: 30 });
  const [action, setAction] = useState<AuditAction | ''>('');

  useEffect(() => {
    if (user && !canViewAudit(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const auditEnabled = canViewAudit(user?.role);

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', page, limit, action],
    queryFn: () =>
      auditService.list({
        page,
        limit,
        action: action || undefined,
      }),
    enabled: auditEnabled,
  });

  if (user && !auditEnabled) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner text="Redirigiendo..." />
      </div>
    );
  }

  const logs = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoría"
        description="Registro de acciones realizadas en el sistema"
      />

      <Card>
        <div className="w-full sm:w-56">
          <Select
            options={actionOptions}
            value={action}
            onChange={(e) => {
              setAction(e.target.value as AuditAction | '');
              setPage(1);
            }}
          />
        </div>
      </Card>

      <Card className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" text="Cargando auditoría..." />
          </div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-500">
            Error al cargar los registros de auditoría.
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="Sin registros"
            description="Aún no hay eventos de auditoría para mostrar."
          />
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Fecha</TableHeaderCell>
                  <TableHeaderCell>Acción</TableHeaderCell>
                  <TableHeaderCell>Entidad</TableHeaderCell>
                  <TableHeaderCell>Usuario</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <span className="text-sm text-gray-700">{formatDateTime(log.createdAt)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={actionBadge[log.action] || 'default'}>
                        {formatAuditAction(log.action)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-gray-900">{log.entityLabel || '—'}</p>
                      <p className="text-xs text-gray-400">
                        {formatEntityType(log.entityType)}
                      </p>
                    </TableCell>
                    <TableCell>
                      {log.user
                        ? `${log.user.firstName} ${log.user.lastName}`
                        : log.userEmail || '—'}
                      {log.user?.email && (
                        <p className="text-xs text-gray-400">{log.user.email}</p>
                      )}
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
    </div>
  );
}
