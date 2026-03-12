/**
 * Servicio de entidades (búsqueda cross-type).
 */
import { apiClient } from './api-client';
import type { ApiResponse, PaginationParams, PaginationMeta } from '@/types/api.types';
import type { Entity } from '@/types/entities.types';

export interface EntityFilters extends PaginationParams {
  entityType?: string;
  status?: string;
  province?: string;
}

export interface EntityListItem extends Omit<Entity, 'contacts' | 'person' | 'company' | 'establishment'> {
  person?: { firstName: string; lastName: string; cedula: string | null };
  company?: { legalName: string; ruc: string | null };
  establishment?: { establishmentName: string };
  contacts?: Array<{ contactType: string; contactValue: string }>;
}

export const entitiesService = {
  async list(params: EntityFilters = {}): Promise<{ data: EntityListItem[]; meta: PaginationMeta }> {
    const res = await apiClient.get<ApiResponse<EntityListItem[]>>('/entities', { params });
    return { data: res.data.data, meta: res.data.meta! };
  },

  async getById(id: string): Promise<EntityListItem> {
    const res = await apiClient.get<ApiResponse<EntityListItem>>(`/entities/${id}`);
    return res.data.data;
  },
};
