/**
 * Servicio de importaciones de Excel.
 */
import { apiClient } from './api-client';
import type { ApiResponse, PaginationParams } from '@/types/api.types';
import type { ImportBatch, StagingRow, SystemField } from '@/types/entities.types';

interface GetImportsParams extends PaginationParams {
  status?: string;
  sourceType?: string;
}

interface GetRowsParams extends PaginationParams {
  status?: string;
}

interface ColumnMapping {
  // Clave = campo del sistema, Valor = columna del Excel (igual que backend)
  [systemField: string]: string;
}

interface ResolveRowInput {
  action: 'approve' | 'skip' | 'link';
  linkedEntityId?: string;
}

export const importsService = {
  async list(params?: GetImportsParams): Promise<ApiResponse<ImportBatch[]>> {
    const res = await apiClient.get<ApiResponse<ImportBatch[]>>('/imports', { params });
    return res.data;
  },

  async getById(id: string): Promise<ImportBatch> {
    const res = await apiClient.get<ApiResponse<ImportBatch>>(`/imports/${id}`);
    return res.data.data;
  },

  async upload(file: File, sourceType: string, targetEventId?: string): Promise<ImportBatch> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sourceType', sourceType);
    if (targetEventId) formData.append('targetEventId', targetEventId);

    const res = await apiClient.post<ApiResponse<ImportBatch>>('/imports/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/imports/${id}`);
  },

  async preview(id: string, limit?: number): Promise<{
    headers: string[];
    rows: Record<string, unknown>[];
    columnMapping?: Record<string, string>;
  }> {
    const res = await apiClient.get<ApiResponse<{
      headers: string[];
      rows?: Record<string, unknown>[];
      sampleRows?: Record<string, unknown>[];
      columnMapping?: Record<string, string>;
    }>>(
      `/imports/${id}/preview`,
      { params: { limit } }
    );
    const data = res.data.data;
    return {
      headers: data.headers ?? [],
      // Backend historicamente usa sampleRows; normalizamos a rows para la UI
      rows: data.rows ?? data.sampleRows ?? [],
      columnMapping: data.columnMapping,
    };
  },

  async updateMapping(id: string, columnMapping: ColumnMapping): Promise<ImportBatch> {
    const res = await apiClient.put<ApiResponse<ImportBatch>>(`/imports/${id}/mapping`, { columnMapping });
    return res.data.data;
  },

  async process(id: string): Promise<ImportBatch> {
    const res = await apiClient.post<ApiResponse<ImportBatch>>(`/imports/${id}/process`);
    return res.data.data;
  },

  async retry(id: string): Promise<ImportBatch> {
    const res = await apiClient.post<ApiResponse<ImportBatch>>(`/imports/${id}/retry`);
    return res.data.data;
  },

  async execute(id: string): Promise<ImportBatch> {
    const res = await apiClient.post<ApiResponse<ImportBatch>>(`/imports/${id}/execute`);
    return res.data.data;
  },

  async sendToVerification(id: string): Promise<{ batchId: string; queued: number }> {
    const res = await apiClient.post<ApiResponse<{ batchId: string; queued: number }>>(
      `/imports/${id}/send-to-verification`
    );
    return res.data.data;
  },

  async cancel(id: string): Promise<ImportBatch> {
    const res = await apiClient.post<ApiResponse<ImportBatch>>(`/imports/${id}/cancel`);
    return res.data.data;
  },

  // Staging rows
  async listRows(importId: string, params?: GetRowsParams): Promise<ApiResponse<StagingRow[]>> {
    const res = await apiClient.get<ApiResponse<StagingRow[]>>(`/imports/${importId}/rows`, { params });
    return res.data;
  },

  async getRow(importId: string, rowId: string): Promise<StagingRow> {
    const res = await apiClient.get<ApiResponse<StagingRow>>(`/imports/${importId}/rows/${rowId}`);
    return res.data.data;
  },

  async resolveRow(importId: string, rowId: string, data: ResolveRowInput): Promise<StagingRow> {
    const res = await apiClient.put<ApiResponse<StagingRow>>(`/imports/${importId}/rows/${rowId}/resolve`, data);
    return res.data.data;
  },

  // System fields
  async getSystemFields(): Promise<SystemField[]> {
    const res = await apiClient.get<ApiResponse<SystemField[]>>('/imports/system-fields');
    return res.data.data;
  },
};
