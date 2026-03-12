/**
 * Servicio de personas.
 */
import { apiClient } from './api-client';
import type { ApiResponse, PaginationParams, PaginationMeta } from '@/types/api.types';
import type { Entity, Person, EntityContact } from '@/types/entities.types';

export interface PersonFilters extends PaginationParams {
  status?: string;
  province?: string;
  cedula?: string;
  gender?: string;
  economicActivity?: string;
}

/**
 * El backend retorna objetos Entity con person/contacts anidados.
 * Estructura: { id (entityId), displayName, province, status, person: { firstName, ... }, contacts: [...] }
 */
export interface PersonListItem extends Entity {
  person: Person;
  contacts: EntityContact[];
}

export interface CreatePersonInput {
  firstName: string;
  lastName: string;
  secondLastName?: string;
  cedula?: string;
  gender?: string;
  birthDate?: string;
  nationality?: string;
  educationLevel?: string;
  province?: string;
  district?: string;
  corregimiento?: string;
  address?: string;
  businessName?: string;
  economicActivity?: string;
  notes?: string;
  contacts?: Array<{
    contactType: string;
    contactValue: string;
    label?: string;
    isPrimary?: boolean;
  }>;
}

export type UpdatePersonInput = Partial<CreatePersonInput>;

export const personsService = {
  async list(params: PersonFilters = {}): Promise<{ data: PersonListItem[]; meta: PaginationMeta }> {
    const res = await apiClient.get<ApiResponse<PersonListItem[]>>('/persons', { params });
    return { data: res.data.data, meta: res.data.meta! };
  },

  async getById(id: string): Promise<PersonListItem> {
    const res = await apiClient.get<ApiResponse<PersonListItem>>(`/persons/${id}`);
    return res.data.data;
  },

  async create(data: CreatePersonInput): Promise<PersonListItem> {
    const res = await apiClient.post<ApiResponse<PersonListItem>>('/persons', data);
    return res.data.data;
  },

  async update(id: string, data: UpdatePersonInput): Promise<PersonListItem> {
    const res = await apiClient.put<ApiResponse<PersonListItem>>(`/persons/${id}`, data);
    return res.data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/persons/${id}`);
  },
};
