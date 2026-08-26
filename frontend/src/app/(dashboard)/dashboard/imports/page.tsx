'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, FileSpreadsheet, Eye, Play, CheckCircle, XCircle, Clock, AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Pagination } from '@/components/ui/pagination';
import { Modal } from '@/components/ui/modal';
import {
  Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell,
} from '@/components/ui/table';
import { useImports, useUploadImport } from '@/hooks/use-imports';
import { usePagination } from '@/hooks/use-pagination';
import { formatDate } from '@/lib/utils';

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'PROCESSING', label: 'Procesando' },
  { value: 'VALIDATING', label: 'Validando' },
  { value: 'DEDUPLICATING', label: 'Deduplicando' },
  { value: 'REVIEW_REQUIRED', label: 'Revisión requerida' },
  { value: 'IMPORTING', label: 'Importando' },
  { value: 'VERIFICATION_QUEUED', label: 'En cola de verificación' },
  { value: 'COMPLETED', label: 'Completado' },
  { value: 'FAILED', label: 'Fallido' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

const sourceTypeOptions = [
  { value: 'UNIFICADA', label: 'Base unificada' },
  { value: 'general', label: 'Carga general' },
  { value: 'event_registration', label: 'Inscripción a evento' },
  { value: 'census', label: 'Censo / Encuesta' },
];

const statusBadge: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'default',
  PROCESSING: 'primary',
  VALIDATING: 'primary',
  DEDUPLICATING: 'warning',
  REVIEW_REQUIRED: 'warning',
  IMPORTING: 'primary',
  VERIFICATION_QUEUED: 'info',
  COMPLETED: 'success',
  FAILED: 'danger',
  CANCELLED: 'default',
};

const statusLabel: Record<string, string> = {
  PENDING: 'Pendiente',
  PROCESSING: 'Procesando',
  VALIDATING: 'Validando',
  DEDUPLICATING: 'Deduplicando',
  REVIEW_REQUIRED: 'Revisión requerida',
  IMPORTING: 'Importando',
  VERIFICATION_QUEUED: 'En cola de verificación',
  COMPLETED: 'Completado',
  FAILED: 'Fallido',
  CANCELLED: 'Cancelado',
};

export default function ImportsPage() {
  const router = useRouter();
  const { page, limit, setPage } = usePagination();
  const [statusFilter, setStatusFilter] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [sourceType, setSourceType] = useState('UNIFICADA');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = useImports({
    page, limit,
    status: statusFilter || undefined,
  });

  const uploadMutation = useUploadImport();

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    try {
      const result = await uploadMutation.mutateAsync({ file, sourceType });
      setIsUploadOpen(false);
      router.push(`/dashboard/imports/${result.id}`);
    } catch { /* toast */ }
  };

  const imports = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importaciones"
        description="Carga masiva desde un archivo de Excel o CSV"
        actions={
          <Button icon={<Upload className="h-4 w-4" />} onClick={() => setIsUploadOpen(true)}>
            Subir archivo
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <div className="flex items-end gap-4">
          <div className="w-full sm:w-56">
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" text="Cargando importaciones..." /></div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-500">Error al cargar las importaciones.</div>
        ) : imports.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="No hay importaciones"
        description="Sube un archivo de Excel o CSV para comenzar una importación masiva."
            action={<Button icon={<Upload className="h-4 w-4" />} onClick={() => setIsUploadOpen(true)}>Subir archivo</Button>}
          />
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Archivo</TableHeaderCell>
                  <TableHeaderCell>Tipo</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell>Filas</TableHeaderCell>
                  <TableHeaderCell>Progreso</TableHeaderCell>
                  <TableHeaderCell>Importado por</TableHeaderCell>
                  <TableHeaderCell>Fecha</TableHeaderCell>
                  <TableHeaderCell align="right">Acciones</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {imports.map((imp) => (
                  <TableRow key={imp.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                        <p className="font-medium text-gray-900 truncate max-w-[200px]">{imp.originalFileName}</p>
                      </div>
                    </TableCell>
                    <TableCell>{imp.sourceType}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadge[imp.status] || 'default'}>
                        {statusLabel[imp.status] || imp.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{imp.totalRows}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-green-600">{imp.importedRows} ✓</span>
                        {imp.invalidRows > 0 && <span className="text-red-500">{imp.invalidRows} ✗</span>}
                        {imp.duplicateRows > 0 && <span className="text-yellow-600">{imp.duplicateRows} dup</span>}
                        {imp.skippedRows > 0 && <span className="text-gray-400">{imp.skippedRows} skip</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {imp.importedBy
                        ? `${imp.importedBy.firstName} ${imp.importedBy.lastName}`
                        : '—'
                      }
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{formatDate(imp.createdAt)}</span>
                    </TableCell>
                    <TableCell align="right">
                      <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/imports/${imp.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
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

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Subir archivo"
        description="Archivo de Excel o CSV, separado por coma o punto y coma."
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsUploadOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpload} isLoading={uploadMutation.isPending}>Subir archivo</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            label="Tipo de importación"
            options={sourceTypeOptions}
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Archivo</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer"
            />
          </div>
          <div className="rounded-lg bg-blue-50 p-3">
            <p className="text-xs text-blue-700">
              <strong>Formato:</strong> archivo de Excel o CSV, separado por coma o punto y coma.
              <br />
              Columnas: Nombre; Apellido; Cédula; RUC; Empresa; Teléfono; Correo; Provincia; Distrito; Corregimiento.
              <br />
              Con nombre/cédula se crea persona; con RUC/empresa se crea empresa; si trae ambos, se crean los dos y comparten teléfono, correo y ubicación.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
