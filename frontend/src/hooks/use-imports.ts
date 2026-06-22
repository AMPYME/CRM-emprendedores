'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { importsService } from '@/services/imports.service';
import type { PaginationParams } from '@/types/api.types';
import toast from 'react-hot-toast';

const IMPORTS_KEY = 'imports';
const IMPORT_ROWS_KEY = 'import-rows';

export function useImports(params?: PaginationParams & { status?: string }) {
  return useQuery({
    queryKey: [IMPORTS_KEY, params],
    queryFn: () => importsService.list(params),
  });
}

export function useImport(id: string | undefined) {
  return useQuery({
    queryKey: [IMPORTS_KEY, id],
    queryFn: () => importsService.getById(id!),
    enabled: !!id,
  });
}

export function useUploadImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, sourceType, targetEventId }: { file: File; sourceType: string; targetEventId?: string }) =>
      importsService.upload(file, sourceType, targetEventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [IMPORTS_KEY] });
      toast.success('Archivo subido exitosamente');
    },
    onError: () => {
      toast.error('Error al subir el archivo');
    },
  });
}

export function useImportPreview(id: string | undefined) {
  return useQuery({
    queryKey: [IMPORTS_KEY, id, 'preview'],
    queryFn: () => importsService.preview(id!),
    enabled: !!id,
  });
}

export function useProcessImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => importsService.process(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [IMPORTS_KEY] });
      toast.success('Procesamiento iniciado');
    },
    onError: () => {
      toast.error('Error al procesar la importación');
    },
  });
}

export function useRetryImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => importsService.retry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [IMPORTS_KEY] });
      toast.success('Reintento iniciado');
    },
    onError: () => {
      toast.error('Error al reintentar la importación');
    },
  });
}

export function useExecuteImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => importsService.execute(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [IMPORTS_KEY] });
      toast.success('Importación ejecutada exitosamente');
    },
    onError: () => {
      toast.error('Error al ejecutar la importación');
    },
  });
}

export function useImportRows(importId: string | undefined, params?: PaginationParams & { status?: string }) {
  return useQuery({
    queryKey: [IMPORT_ROWS_KEY, importId, params],
    queryFn: () => importsService.listRows(importId!, params),
    enabled: !!importId,
  });
}

export function useSystemFields() {
  return useQuery({
    queryKey: ['system-fields'],
    queryFn: () => importsService.getSystemFields(),
    staleTime: Infinity,
  });
}
