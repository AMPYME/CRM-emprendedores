/**
 * Servicio de cartera/seguimiento.
 */
import { apiClient } from './api-client';
import type { ApiResponse, PaginationParams } from '@/types/api.types';
import type { PortfolioRecord, PortfolioAction, PortfolioStats } from '@/types/entities.types';

interface GetPortfolioParams extends PaginationParams {
  search?: string;
  documento?: string;
  status?: string;
  excludeResolved?: boolean;
  priority?: string;
  assignedToId?: string;
  sedeId?: string;
  departamentoId?: string;
  category?: string;
  view?: 'overdue' | 'upcoming' | 'unmanaged';
}

interface CreatePortfolioInput {
  entityId: string;
  assignedToId?: string;
  priority?: string;
  category?: string;
  subject: string;
  description?: string;
  nextFollowUpDate?: string;
}

type UpdatePortfolioInput = Partial<Omit<CreatePortfolioInput, 'entityId'>> & {
  status?: string;
};

interface CreateActionInput {
  actionType: string;
  description: string;
  result?: string;
  nextSteps?: string;
  actionDate?: string;
  performedById?: string;
}

export const portfolioService = {
  async list(params?: GetPortfolioParams): Promise<ApiResponse<PortfolioRecord[]>> {
    const res = await apiClient.get<ApiResponse<PortfolioRecord[]>>('/portfolios', { params });
    return res.data;
  },

  async getById(id: string): Promise<PortfolioRecord> {
    const res = await apiClient.get<ApiResponse<PortfolioRecord>>(`/portfolios/${id}`);
    return res.data.data;
  },

  async create(data: CreatePortfolioInput): Promise<PortfolioRecord> {
    const res = await apiClient.post<ApiResponse<PortfolioRecord>>('/portfolios', data);
    return res.data.data;
  },

  async update(id: string, data: UpdatePortfolioInput): Promise<PortfolioRecord> {
    const res = await apiClient.put<ApiResponse<PortfolioRecord>>(`/portfolios/${id}`, data);
    return res.data.data;
  },

  async getStats(): Promise<PortfolioStats> {
    const res = await apiClient.get<ApiResponse<PortfolioStats>>('/portfolios/stats');
    return res.data.data;
  },

  async downloadBySede(from: string, to: string): Promise<void> {
    const res = await apiClient.get('/portfolios/export', {
      params: { from, to },
      responseType: 'blob',
      timeout: 120000,
    });
    const blob = res.data as Blob;
    const contentType = String(res.headers['content-type'] || blob.type || '');
    if (contentType.includes('application/json')) {
      const text = await blob.text();
      let message = 'No se pudo descargar el archivo';
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string } };
        if (parsed.error?.message) message = parsed.error.message;
      } catch {
        /* el cuerpo no era JSON */
      }
      throw new Error(message);
    }
    const disposition = String(res.headers['content-disposition'] || '');
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] || `seguimientos_${from}_${to}.xlsx`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },

  // Acciones
  async listActions(portfolioId: string): Promise<PortfolioAction[]> {
    const res = await apiClient.get<ApiResponse<PortfolioAction[]>>(`/portfolios/${portfolioId}/actions`);
    return res.data.data;
  },

  async addAction(portfolioId: string, data: CreateActionInput): Promise<PortfolioAction> {
    const res = await apiClient.post<ApiResponse<PortfolioAction>>(`/portfolios/${portfolioId}/actions`, data);
    return res.data.data;
  },

  // Por entidad
  async listByEntity(entityId: string): Promise<PortfolioRecord[]> {
    const res = await apiClient.get<ApiResponse<PortfolioRecord[]>>(`/entities/${entityId}/portfolios`);
    return res.data.data;
  },
};
