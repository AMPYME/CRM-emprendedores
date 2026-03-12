/**
 * Servicio de relaciones entre entidades.
 */
import { apiClient } from './api-client';
import type { ApiResponse } from '@/types/api.types';
import type { EntityRelationship, RelationshipType } from '@/types/entities.types';

export interface RelationshipListParams {
  direction?: 'from' | 'to' | 'both';
  relationshipType?: RelationshipType;
  targetEntityType?: 'PERSON' | 'COMPANY' | 'ESTABLISHMENT';
  isActive?: boolean;
}

export interface CreateRelationshipInput {
  toEntityId: string;
  relationshipType: RelationshipType;
  role?: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}

export type UpdateRelationshipInput = Partial<CreateRelationshipInput>;

export const relationshipsService = {
  async listByEntity(
    entityId: string,
    params: RelationshipListParams = {}
  ): Promise<EntityRelationship[]> {
    const res = await apiClient.get<ApiResponse<EntityRelationship[]>>(
      `/entities/${entityId}/relationships`,
      { params }
    );
    return res.data.data;
  },

  async create(entityId: string, data: CreateRelationshipInput): Promise<EntityRelationship> {
    const res = await apiClient.post<ApiResponse<EntityRelationship>>(
      `/entities/${entityId}/relationships`,
      data
    );
    return res.data.data;
  },

  async update(id: string, data: UpdateRelationshipInput): Promise<EntityRelationship> {
    const res = await apiClient.put<ApiResponse<EntityRelationship>>(
      `/relationships/${id}`,
      data
    );
    return res.data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/relationships/${id}`);
  },
};

