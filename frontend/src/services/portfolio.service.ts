/**
 * Servicio de cartera/seguimiento.
 */
import { apiClient } from './api-client';
import type { ApiResponse, PaginationParams } from '@/types/api.types';
import type { PortfolioRecord, PortfolioAction, PortfolioStats } from '@/types/entities.types';

interface GetPortfolioParams extends PaginationParams {
  status?: string;
  priority?: string;
  assignedToId?: string;
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
