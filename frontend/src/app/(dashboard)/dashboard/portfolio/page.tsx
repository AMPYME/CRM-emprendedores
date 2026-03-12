'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FolderKanban, Plus, Eye, AlertTriangle, Clock } from 'lucide-react';
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
import { usePortfolios, usePortfolioStats } from '@/hooks/use-portfolio';
import { usePagination } from '@/hooks/use-pagination';
import { formatDateShort } from '@/lib/utils';

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

export default function PortfolioPage() {
  const router = useRouter();
  const { page, limit, setPage, searchQuery, setSearchQuery } = usePagination();
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const { data, isLoading, error } = usePortfolios({
    page, limit,
    search: searchQuery || undefined,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
  });

  const stats = usePortfolioStats();

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setPage(1);
  }, [setSearchQuery, setPage]);

  const records = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cartera de Seguimiento"
        description="Gestión de casos y seguimiento de emprendedores"
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
            description={searchQuery ? 'No se encontraron resultados.' : 'La cartera de seguimiento está vacía.'}
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
    </div>
  );
}
