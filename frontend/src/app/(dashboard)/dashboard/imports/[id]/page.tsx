'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, FileSpreadsheet, Play, CheckCircle, XCircle, AlertTriangle,
  ArrowRight, RefreshCw, Columns, Eye, Upload, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import {
  Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell,
} from '@/components/ui/table';
import {
  useImport, useImportPreview, useProcessImport, useRetryImport, useExecuteImport, useImportRows, useSystemFields,
} from '@/hooks/use-imports';
import { importsService } from '@/services/imports.service';
import { usePagination } from '@/hooks/use-pagination';
import { formatDate, cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { ImportStatus, StagingRowStatus } from '@/types/entities.types';

/* ──────────────────────────────────────────────── */
/* Constants                                        */
/* ──────────────────────────────────────────────── */
const statusBadge: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'default', PROCESSING: 'primary', VALIDATING: 'primary',
  DEDUPLICATING: 'warning', REVIEW_REQUIRED: 'warning', IMPORTING: 'primary',
  COMPLETED: 'success', FAILED: 'danger', CANCELLED: 'default',
};
const statusLabel: Record<string, string> = {
  PENDING: 'Pendiente', PROCESSING: 'Procesando', VALIDATING: 'Validando',
  DEDUPLICATING: 'Deduplicando', REVIEW_REQUIRED: 'Revisión requerida',
  IMPORTING: 'Importando', COMPLETED: 'Completado', FAILED: 'Fallido', CANCELLED: 'Cancelado',
};
const rowStatusBadge: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'default', VALID: 'success', INVALID: 'danger',
  DUPLICATE_EXACT: 'warning', DUPLICATE_POSSIBLE: 'warning',
  IMPORTED: 'success', SKIPPED: 'default', ERROR: 'danger',
};
const rowStatusLabel: Record<string, string> = {
  PENDING: 'Pendiente', VALID: 'Válido', INVALID: 'Inválido',
  DUPLICATE_EXACT: 'Duplicado exacto', DUPLICATE_POSSIBLE: 'Posible duplicado',
  IMPORTED: 'Importado', SKIPPED: 'Omitido', ERROR: 'Error',
};
const rowStatusFilterOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'VALID', label: 'Válido' },
  { value: 'INVALID', label: 'Inválido' },
  { value: 'DUPLICATE_EXACT', label: 'Duplicado exacto' },
  { value: 'DUPLICATE_POSSIBLE', label: 'Posible duplicado' },
  { value: 'IMPORTED', label: 'Importado' },
  { value: 'SKIPPED', label: 'Omitido' },
  { value: 'ERROR', label: 'Error' },
];

/* ──────────────────────────────────────────────── */
/* Wizard Steps                                     */
/* ──────────────────────────────────────────────── */
type WizardStep = 'preview' | 'mapping' | 'process' | 'rows';

function invertMapping(map: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map || {})) {
    if (!k || !v) continue;
    out[v] = k;
  }
  return out;
}

function stepForStatus(status: ImportStatus): WizardStep {
  switch (status) {
    case 'PENDING': return 'preview';
    case 'PROCESSING':
    case 'VALIDATING':
    case 'DEDUPLICATING':
      return 'process';
    case 'REVIEW_REQUIRED':
    case 'IMPORTING':
      return 'rows';
    case 'COMPLETED':
    case 'FAILED':
    case 'CANCELLED':
      return 'rows';
    default:
      return 'preview';
  }
}

const steps: { id: WizardStep; label: string }[] = [
  { id: 'preview', label: '1. Previsualización' },
  { id: 'mapping', label: '2. Mapeo de columnas' },
  { id: 'process', label: '3. Procesamiento' },
  { id: 'rows', label: '4. Resultados' },
];

/* ──────────────────────────────────────────────── */
/* Component                                        */
/* ──────────────────────────────────────────────── */
export default function ImportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: batch, isLoading, error } = useImport(id);
  const preview = useImportPreview(id);
  const systemFields = useSystemFields();
  const processMutation = useProcessImport();
  const retryMutation = useRetryImport();
  const executeMutation = useExecuteImport();

  // Wizard step
  const currentStep = batch ? stepForStatus(batch.status) : 'preview';
  const [activeStep, setActiveStep] = useState<WizardStep | null>(null);
  const step = activeStep || currentStep;

  // Mapping state
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [savingMapping, setSavingMapping] = useState(false);

  // Rows state
  const { page, limit, setPage } = usePagination();
  const [rowStatusFilter, setRowStatusFilter] = useState('');
  const rows = useImportRows(id, { page, limit, status: rowStatusFilter || undefined });

  // Initialize mapping from batch
  React.useEffect(() => {
    if (batch?.columnMapping && typeof batch.columnMapping === 'object') {
      // Backend guarda: { systemField: excelHeader }. La UI necesita: { excelHeader: systemField }.
      setMapping(invertMapping(batch.columnMapping as Record<string, string>));
    }
  }, [batch?.columnMapping]);

  const handleSaveMapping = async () => {
    if (!id) return;
    setSavingMapping(true);
    try {
      // Convertir UI mapping (excelHeader -> systemField) a formato backend (systemField -> excelHeader)
      await importsService.updateMapping(id, invertMapping(mapping));
      qc.invalidateQueries({ queryKey: ['imports', id] });
      toast.success('Mapeo guardado');
    } catch {
      toast.error('Error al guardar mapeo');
    } finally {
      setSavingMapping(false);
    }
  };

  const handleProcess = async () => {
    if (!id) return;
    try {
      await processMutation.mutateAsync(id);
      qc.invalidateQueries({ queryKey: ['imports', id] });
    } catch { /* toast */ }
  };

  const handleExecute = async () => {
    if (!id) return;
    if (!window.confirm('¿Estás seguro de ejecutar la importación? Los registros válidos se importarán al sistema.')) return;
    try {
      await executeMutation.mutateAsync(id);
      qc.invalidateQueries({ queryKey: ['imports', id] });
    } catch { /* toast */ }
  };

  const handleCancel = async () => {
    if (!id) return;
    if (!window.confirm('¿Cancelar esta importación?')) return;
    try {
      await importsService.cancel(id);
      qc.invalidateQueries({ queryKey: ['imports', id] });
      toast.success('Importación cancelada');
    } catch {
      toast.error('Error al cancelar');
    }
  };

  /* ── Loading / Error ────────────────────────── */
  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" text="Cargando importación..." /></div>;
  }

  if (error || !batch) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-red-500">No se pudo cargar la importación.</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/imports')}>Volver</Button>
      </div>
    );
  }

  const previewHeaders = preview.data?.headers ?? [];
  const previewRows = preview.data?.rows ?? [];
  const fields = systemFields.data ?? [];
  const isProcessing = ['PROCESSING', 'VALIDATING', 'DEDUPLICATING', 'IMPORTING'].includes(batch.status);
  const isDone = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(batch.status);
  const canProcess = batch.status === 'PENDING';
  const canExecute = batch.status === 'REVIEW_REQUIRED';
  const canRetry = ['PENDING', 'REVIEW_REQUIRED', 'FAILED', 'CANCELLED'].includes(batch.status) && !isProcessing;

  const handleRetry = async () => {
    if (!id) return;
    if (!window.confirm('¿Reintentar procesamiento? Se borrarán las filas procesadas (staging) y se volverá a procesar el mismo archivo.')) return;
    try {
      await retryMutation.mutateAsync(id);
      qc.invalidateQueries({ queryKey: ['imports', id] });
      qc.invalidateQueries({ queryKey: ['import-rows', id] });
      toast.success('Reintento iniciado');
    } catch { /* toast */ }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/imports')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-6 w-6 text-green-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 truncate">{batch.originalFileName}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={statusBadge[batch.status] || 'default'}>
                  {statusLabel[batch.status] || batch.status}
                </Badge>
                <span className="text-xs text-gray-400">{batch.sourceType} · {batch.totalRows} filas</span>
                <span className="text-xs text-gray-400">Subido {formatDate(batch.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
        {!isDone && (
          <Button variant="outline" size="sm" className="text-red-500" onClick={handleCancel}>
            Cancelar
          </Button>
        )}
      </div>

      {/* Retry bar */}
      {canRetry && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium text-amber-900">¿Necesitas reintentar?</p>
              <p className="text-sm text-amber-800">
                Reprocesa el mismo archivo sin volver a subirlo (se reinician las filas de staging).
              </p>
            </div>
            <Button
              variant="outline"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={handleRetry}
              isLoading={retryMutation.isPending}
            >
              Reintentar
            </Button>
          </div>
        </Card>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatBox label="Total" value={batch.totalRows} />
        <StatBox label="Válidos" value={batch.validRows} color="text-green-600" />
        <StatBox label="Inválidos" value={batch.invalidRows} color="text-red-600" />
        <StatBox label="Duplicados" value={batch.duplicateRows} color="text-yellow-600" />
        <StatBox label="Importados" value={batch.importedRows} color="text-blue-600" />
      </div>

      {/* Wizard Steps indicator */}
      <div className="flex items-center gap-1 rounded-lg border bg-gray-50 p-2">
        {steps.map((s, i) => {
          const isActive = s.id === step;
          const stepIdx = steps.findIndex((st) => st.id === currentStep);
          const isPast = i < stepIdx;
          return (
            <React.Fragment key={s.id}>
              {i > 0 && <ArrowRight className="h-4 w-4 text-gray-300 flex-shrink-0" />}
              <button
                type="button"
                className={cn(
                  'flex-1 rounded-md px-3 py-2 text-center text-xs font-medium transition',
                  isActive ? 'bg-white shadow text-primary-700' :
                  isPast ? 'text-green-600' : 'text-gray-400',
                )}
                onClick={() => setActiveStep(s.id)}
              >
                {isPast && <CheckCircle className="inline h-3 w-3 mr-1" />}
                {isProcessing && s.id === currentStep && <Loader2 className="inline h-3 w-3 mr-1 animate-spin" />}
                {s.label}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* ── STEP: PREVIEW ────────────────────────── */}
      {step === 'preview' && (
        <Card title="Previsualización del archivo" description="Primeras filas del archivo subido">
          {preview.isLoading ? (
            <LoadingSpinner text="Cargando previsualización..." />
          ) : previewHeaders.length === 0 ? (
            <EmptyState icon={Eye} title="Sin datos" description="No se pudieron leer datos del archivo." />
          ) : (
            <>
              <div className="overflow-x-auto max-h-[400px]">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left font-semibold text-gray-500">#</th>
                      {previewHeaders.map((h) => (
                        <th key={h} className="px-2 py-1 text-left font-semibold text-gray-500 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className="border-t hover:bg-gray-50">
                        <td className="px-2 py-1 text-gray-400">{idx + 1}</td>
                        {previewHeaders.map((h) => (
                          <td key={h} className="px-2 py-1 whitespace-nowrap max-w-[200px] truncate">
                            {String(row[h] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-end">
                <Button size="sm" icon={<ArrowRight className="h-4 w-4" />} onClick={() => setActiveStep('mapping')}>
                  Continuar al mapeo
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      {/* ── STEP: MAPPING ────────────────────────── */}
      {step === 'mapping' && (
        <Card title="Mapeo de columnas" description="Asigna cada columna del archivo a un campo del sistema">
          {preview.isLoading || systemFields.isLoading ? (
            <LoadingSpinner text="Cargando..." />
          ) : (
            <>
              <div className="space-y-3">
                {previewHeaders.map((header) => (
                  <div key={header} className="flex items-center gap-4">
                    <div className="w-1/3">
                      <p className="text-sm font-medium text-gray-900">{header}</p>
                      <p className="text-xs text-gray-400 truncate">
                        Ej: {String(previewRows[0]?.[header] ?? '—')}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                    <div className="flex-1">
                      <select
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        value={mapping[header] || ''}
                        onChange={(e) => setMapping((p) => ({ ...p, [header]: e.target.value }))}
                      >
                        <option value="">— Ignorar —</option>
                        {fields.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label} ({f.group})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-between">
                <Button variant="outline" size="sm" onClick={() => setActiveStep('preview')}>
                  Volver
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSaveMapping} isLoading={savingMapping}>
                    Guardar mapeo
                  </Button>
                  {canProcess && (
                    <Button size="sm" icon={<Play className="h-4 w-4" />} onClick={handleProcess} isLoading={processMutation.isPending}>
                      Procesar
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      {/* ── STEP: PROCESS ────────────────────────── */}
      {step === 'process' && (
        <Card title="Procesamiento" description="Estado del procesamiento de la importación">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            {isProcessing ? (
              <>
                <Loader2 className="h-16 w-16 text-primary-500 animate-spin mb-4" />
                <h3 className="text-lg font-semibold text-gray-900">Procesando importación...</h3>
                <p className="text-sm text-gray-500 mt-2">
                  Estado actual: <strong>{statusLabel[batch.status]}</strong>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Este proceso puede tardar unos minutos. Puedes recargar la página para ver el progreso.
                </p>
                <Button
                  variant="outline" size="sm" className="mt-4"
                  icon={<RefreshCw className="h-4 w-4" />}
                  onClick={() => qc.invalidateQueries({ queryKey: ['imports', id] })}
                >
                  Actualizar estado
                </Button>
              </>
            ) : canProcess ? (
              <>
                <Play className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900">Listo para procesar</h3>
                <p className="text-sm text-gray-500 mt-2">
                  Configura el mapeo de columnas y luego inicia el procesamiento.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setActiveStep('mapping')}>
                    Ir a mapeo
                  </Button>
                  <Button size="sm" icon={<Play className="h-4 w-4" />} onClick={handleProcess} isLoading={processMutation.isPending}>
                    Procesar ahora
                  </Button>
                </div>
              </>
            ) : (
              <>
                <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900">Procesamiento completado</h3>
                <p className="text-sm text-gray-500 mt-2">
                  Revisa los resultados en la pestaña de resultados.
                </p>
                <Button size="sm" className="mt-4" onClick={() => setActiveStep('rows')}>
                  Ver resultados
                </Button>
              </>
            )}
          </div>
        </Card>
      )}

      {/* ── STEP: ROWS ───────────────────────────── */}
      {step === 'rows' && (
        <div className="space-y-4">
          {/* Execute action bar */}
          {canExecute && (
            <Card className="border-blue-200 bg-blue-50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-blue-900">Revisión completada</p>
                  <p className="text-sm text-blue-700">
                    {batch.validRows} registros válidos listos para importar.
                    {batch.invalidRows > 0 && ` ${batch.invalidRows} inválidos serán omitidos.`}
                    {batch.duplicateRows > 0 && ` ${batch.duplicateRows} duplicados encontrados.`}
                  </p>
                </div>
                <Button
                  icon={<Upload className="h-4 w-4" />}
                  onClick={handleExecute}
                  isLoading={executeMutation.isPending}
                >
                  Ejecutar importación
                </Button>
              </div>
            </Card>
          )}

          <Card title="Filas de importación">
            <div className="mb-4 flex items-end gap-4">
              <div className="w-56">
                <Select
                  options={rowStatusFilterOptions}
                  value={rowStatusFilter}
                  onChange={(e) => { setRowStatusFilter(e.target.value); setPage(1); }}
                />
              </div>
            </div>

            {rows.isLoading ? (
              <LoadingSpinner text="Cargando filas..." />
            ) : !rows.data || rows.data.data.length === 0 ? (
              <EmptyState icon={FileSpreadsheet} title="Sin filas" description="No se encontraron filas con el filtro seleccionado." />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>#</TableHeaderCell>
                        <TableHeaderCell>Estado</TableHeaderCell>
                        <TableHeaderCell>Nombre</TableHeaderCell>
                        <TableHeaderCell>Cédula/RUC</TableHeaderCell>
                        <TableHeaderCell>Email</TableHeaderCell>
                        <TableHeaderCell>Teléfono</TableHeaderCell>
                        <TableHeaderCell>Errores</TableHeaderCell>
                        <TableHeaderCell>Match</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.data.data.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <span className="font-mono text-xs text-gray-500">{row.rowNumber}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={rowStatusBadge[row.status] || 'default'}>
                              {rowStatusLabel[row.status] || row.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {[row.extractedFirstName, row.extractedLastName].filter(Boolean).join(' ') || row.extractedBusinessName || '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs">
                              {row.extractedCedula || row.extractedRuc || '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs">{row.extractedEmail || '—'}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs">{row.extractedPhone || '—'}</span>
                          </TableCell>
                          <TableCell>
                            {row.validationErrors ? (
                              <span className="text-xs text-red-500 max-w-[150px] truncate block">
                                {Array.isArray(row.validationErrors)
                                  ? (row.validationErrors as string[]).join(', ')
                                  : JSON.stringify(row.validationErrors)
                                }
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.matchedEntityId ? (
                              <span className="text-xs">
                                <span className="text-blue-600">{row.matchScore}%</span>
                                {row.matchReason && (
                                  <span className="text-gray-400 ml-1">({row.matchReason})</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {rows.data.meta && rows.data.meta.totalPages > 1 && (
                  <div className="border-t p-4 flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      {(rows.data.meta.page - 1) * rows.data.meta.limit + 1} - {Math.min(rows.data.meta.page * rows.data.meta.limit, rows.data.meta.total)} de {rows.data.meta.total}
                    </p>
                    <Pagination currentPage={rows.data.meta.page} totalPages={rows.data.meta.totalPages} onPageChange={setPage} />
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg border bg-white p-3 text-center">
      <p className={cn('text-2xl font-bold', color || 'text-gray-900')}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
