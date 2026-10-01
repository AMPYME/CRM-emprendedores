/**
 * Servicio de solicitudes de confirmación de persona.
 */
import { apiClient } from './api-client';
import type { ApiResponse, PaginationMeta } from '@/types/api.types';

export interface PersonChangeRequest {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'REGISTRO_EMPRESARIAL' | 'CAPITAL_SEMILLA';
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  entityId: string | null;
  personId: string | null;
  payload: unknown;
  summary: string | null;
  requestedById: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export const personChangesService = {
  async listMine(params: {
    status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'ALL';
    documento?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: PersonChangeRequest[]; meta: PaginationMeta }> {
    const res = await apiClient.get<ApiResponse<PersonChangeRequest[]>>('/person-change-requests', {
      params,
    });
    return { data: res.data.data, meta: res.data.meta! };
  },

  async hasPending(entityId: string): Promise<boolean> {
    const res = await apiClient.get<ApiResponse<{ pending: boolean }>>('/person-change-requests/pending', {
      params: { entityId },
    });
    return Boolean(res.data.data?.pending);
  },

  async confirm(id: string): Promise<unknown> {
    const res = await apiClient.post<ApiResponse<unknown>>(`/person-change-requests/${id}/confirm`);
    return res.data.data;
  },

  async cancel(id: string): Promise<unknown> {
    const res = await apiClient.post<ApiResponse<unknown>>(`/person-change-requests/${id}/cancel`);
    return res.data.data;
  },
};
