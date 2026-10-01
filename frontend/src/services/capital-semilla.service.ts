/**
 * Servicio frontend de Capital Semilla.
 */
import { apiClient } from './api-client';
import type { ApiResponse, PaginationMeta } from '@/types/api.types';

export interface CapitalSemillaListItem {
  id: string;
  externalId: number | null;
  cedula: string;
  province: string | null;
  businessName: string | null;
  actaNumber: string | null;
  amount: string | null;
  personId: string | null;
  linkedAt: string | null;
  person: {
    id: string;
    entityId: string;
    displayName: string;
    entityType: string;
    documentNumber: string | null;
  } | null;
}

export interface CapitalSemillaVerificacion {
  id: string;
  personId: string;
  displayName: string;
  entityType: 'PERSON';
  cedula: string | null;
  linkedAt: string | null;
  capitalSemillaId: string | null;
}

export const capitalSemillaService = {
  async list(params: {
    page?: number;
    limit?: number;
    search?: string;
    linked?: 'all' | 'yes' | 'no';
  } = {}): Promise<{ data: CapitalSemillaListItem[]; meta: PaginationMeta }> {
    const res = await apiClient.get<ApiResponse<CapitalSemillaListItem[]>>('/capital-semilla', {
      params,
    });
    return { data: res.data.data, meta: res.data.meta! };
  },

  async verificar(documento: string): Promise<CapitalSemillaVerificacion[]> {
    const res = await apiClient.get<ApiResponse<CapitalSemillaVerificacion[]>>(
      '/capital-semilla/verificar',
      { params: { documento } }
    );
    return res.data.data;
  },

  async setFecha(
    entityId: string,
    linkedAt: string | null
  ): Promise<{ queued: boolean; message?: string }> {
    const res = await apiClient.patch<ApiResponse<{ queued: boolean; message?: string }>>(
      `/capital-semilla/persona/${entityId}/fecha`,
      { linkedAt }
    );
    return res.data.data;
  },

  async link(
    id: string,
    data: { personId: string; linkedAt: string }
  ): Promise<CapitalSemillaListItem> {
    const res = await apiClient.post<ApiResponse<CapitalSemillaListItem>>(
      `/capital-semilla/${id}/link`,
      data
    );
    return res.data.data;
  },
};
