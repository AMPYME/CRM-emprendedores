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

export interface EntityListItem extends Omit<Entity, 'contacts' | 'person' | 'company'> {
  person?: { firstName: string; lastName: string; cedula: string | null };
  company?: { legalName: string; ruc: string | null };
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

  async setRegistroEmpresarial(id: string, fecha: string | null): Promise<EntityListItem> {
    const res = await apiClient.patch<ApiResponse<EntityListItem>>(`/entities/${id}/registro-empresarial`, { fecha });
    return res.data.data;
  },

  async verificar(documento: string): Promise<Array<{
    id: string;
    displayName: string;
    entityType: 'PERSON' | 'COMPANY';
    registroEmpresarialFecha: string | null;
  }>> {
    const res = await apiClient.get<ApiResponse<Array<{
      id: string;
      displayName: string;
      entityType: 'PERSON' | 'COMPANY';
      registroEmpresarialFecha: string | null;
    }>>>('/entities/verificar', { params: { documento } });
    return res.data.data;
  },

  async historial(id: string, page = 1): Promise<EntityHistorial> {
    const res = await apiClient.get<ApiResponse<EntityHistorial>>(`/entities/${id}/historial`, {
      params: { page, limit: 30 },
    });
    return res.data.data;
  },
};

export interface EntityHistorialEvento {
  id: string;
  action: string;
  entityType: string | null;
  createdAt: string;
  usuario: string | null;
  sede: string | null;
  departamento: string | null;
  anterior: Record<string, unknown> | null;
  nuevo: Record<string, unknown> | null;
  campos: string[] | null;
}

export interface EntityHistorial {
  introduccion: {
    fecha: string;
    origen: string | null;
    usuario: string | null;
    sede: string | null;
    departamento: string | null;
  };
  resumen: {
    total: number;
    desde: string;
    hasta: string;
    tieneAlta: boolean;
  };
  data: EntityHistorialEvento[];
  meta: PaginationMeta;
}
