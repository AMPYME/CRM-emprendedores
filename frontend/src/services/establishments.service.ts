/**
 * Servicio de establecimientos.
 */
import { apiClient } from './api-client';
import type { ApiResponse, PaginationParams, PaginationMeta } from '@/types/api.types';
import type { Entity, Establishment, EntityContact } from '@/types/entities.types';

export interface EstablishmentFilters extends PaginationParams {
  status?: string;
  province?: string;
  establishmentType?: string;
  economicActivity?: string;
}

export interface EstablishmentListItem {
  entity: Entity & { contacts: EntityContact[] };
  id: string;
  entityId: string;
  establishmentName: string;
  establishmentType: string | null;
  economicActivity: string | null;
  noticeOfOperation: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface CreateEstablishmentInput {
  establishmentName: string;
  establishmentType?: string;
  economicActivity?: string;
  noticeOfOperation?: string;
  latitude?: number;
  longitude?: number;
  province?: string;
  district?: string;
  corregimiento?: string;
  address?: string;
  notes?: string;
  contacts?: Array<{
    contactType: string;
    contactValue: string;
    label?: string;
    isPrimary?: boolean;
  }>;
}

export type UpdateEstablishmentInput = Partial<CreateEstablishmentInput>;

export const establishmentsService = {
  async list(params: EstablishmentFilters = {}): Promise<{ data: EstablishmentListItem[]; meta: PaginationMeta }> {
    const res = await apiClient.get<ApiResponse<EstablishmentListItem[]>>('/establishments', { params });
    return { data: res.data.data, meta: res.data.meta! };
  },

  async getById(id: string): Promise<EstablishmentListItem> {
    const res = await apiClient.get<ApiResponse<EstablishmentListItem>>(`/establishments/${id}`);
    return res.data.data;
  },

  async create(data: CreateEstablishmentInput): Promise<EstablishmentListItem> {
    const res = await apiClient.post<ApiResponse<EstablishmentListItem>>('/establishments', data);
    return res.data.data;
  },

  async update(id: string, data: UpdateEstablishmentInput): Promise<EstablishmentListItem> {
    const res = await apiClient.put<ApiResponse<EstablishmentListItem>>(`/establishments/${id}`, data);
    return res.data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/establishments/${id}`);
  },
};
