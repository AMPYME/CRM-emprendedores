/**
 * Servicio de contactos.
 */
import { apiClient } from './api-client';
import type { ApiResponse } from '@/types/api.types';
import type { EntityContact } from '@/types/entities.types';

export interface CreateContactInput {
  contactType: string;
  contactValue: string;
  label?: string;
  isPrimary?: boolean;
}

export type UpdateContactInput = Partial<CreateContactInput>;

export const contactsService = {
  async listByEntity(entityId: string): Promise<EntityContact[]> {
    const res = await apiClient.get<ApiResponse<EntityContact[]>>(`/entities/${entityId}/contacts`);
    return res.data.data;
  },

  async create(entityId: string, data: CreateContactInput): Promise<EntityContact> {
    const res = await apiClient.post<ApiResponse<EntityContact>>(`/entities/${entityId}/contacts`, data);
    return res.data.data;
  },

  async update(contactId: string, data: UpdateContactInput): Promise<EntityContact> {
    const res = await apiClient.put<ApiResponse<EntityContact>>(`/contacts/${contactId}`, data);
    return res.data.data;
  },

  async remove(contactId: string): Promise<void> {
    await apiClient.delete(`/contacts/${contactId}`);
  },
};
