/**
 * Servicio de personas.
 */
import { apiClient } from './api-client';
import type { ApiResponse, PaginationParams, PaginationMeta } from '@/types/api.types';
import type { Entity, Person, EntityContact } from '@/types/entities.types';

export interface PersonFilters extends PaginationParams {
  status?: string;
  province?: string;
  district?: string;
  corregimiento?: string;
  cedula?: string;
  gender?: string;
  economicActivity?: string;
  hasArtisanCard?: boolean;
  seedCapital?: 0 | 1;
}

/**
 * El backend retorna objetos Entity con person/contacts anidados.
 * Estructura: { id (entityId), displayName, province, status, person: { firstName, ... }, contacts: [...] }
 */
export interface CapitalSemillaRecord {
  id: string;
  externalId: number | null;
  cedula: string;
  province: string | null;
  businessName: string | null;
  actaNumber: string | null;
  amount: string | null;
}

export interface CapitalSemillaLink {
  cedula: string | null;
  records: CapitalSemillaRecord[];
}

export interface PersonListItem extends Entity {
  person: Person;
  contacts: EntityContact[];
}

export interface CreatePersonInput {
  firstName: string;
  lastName: string;
  secondLastName?: string;
  documentType?: 'CEDULA_NUMERO' | 'CEDULA_LETRA' | 'PASAPORTE';
  documentNumber?: string;
  cedula?: string;
  gender?: string;
  birthDate?: string;
  nationalityCode?: string;
  educationLevel?: string;
  province?: string;
  district?: string;
  corregimiento?: string;
  address?: string;
  businessName?: string;
  economicActivity?: string;
  hasArtisanCard?: boolean;
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

  async lookupByCedula(cedula: string): Promise<PersonListItem> {
    const res = await apiClient.get<ApiResponse<PersonListItem>>('/persons/lookup', {
      params: { cedula },
    });
    return res.data.data;
  },

  async listCapitalSemilla(id: string): Promise<CapitalSemillaLink> {
    const res = await apiClient.get<ApiResponse<CapitalSemillaLink>>(`/persons/${id}/capital-semilla`);
    return res.data.data;
  },

  async saveCapitalSemilla(
    id: string,
    data: {
      recordId?: string;
      province?: string;
      businessName?: string;
      actaNumber?: string;
      amount?: string;
    }
  ): Promise<CapitalSemillaRecord> {
    const res = await apiClient.put<ApiResponse<CapitalSemillaRecord>>(`/persons/${id}/capital-semilla`, data);
    return res.data.data;
  },

  async getById(id: string): Promise<PersonListItem> {
    const res = await apiClient.get<ApiResponse<PersonListItem>>(`/persons/${id}`);
    return res.data.data;
  },

  async create(data: CreatePersonInput): Promise<{ queued: boolean; id: string; message?: string }> {
    const res = await apiClient.post<ApiResponse<{ queued: boolean; id: string; message?: string }>>(
      '/persons',
      data
    );
    return res.data.data;
  },

  async update(id: string, data: UpdatePersonInput): Promise<{ queued: boolean; id: string; message?: string }> {
    const res = await apiClient.put<ApiResponse<{ queued: boolean; id: string; message?: string }>>(
      `/persons/${id}`,
      data
    );
    return res.data.data;
  },

  async remove(id: string): Promise<{ queued: boolean; id: string; message?: string }> {
    const res = await apiClient.delete<ApiResponse<{ queued: boolean; id: string; message?: string }>>(
      `/persons/${id}`
    );
    return res.data.data;
  },
};
