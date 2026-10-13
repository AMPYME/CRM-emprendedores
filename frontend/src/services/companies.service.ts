/**
 * Servicio de empresas.
 */
import { apiClient } from './api-client';
import type { ApiResponse, PaginationParams, PaginationMeta } from '@/types/api.types';
import type { Entity, Company, EntityContact } from '@/types/entities.types';

export interface CompanyFilters extends PaginationParams {
  status?: string;
  province?: string;
  district?: string;
  corregimiento?: string;
  ruc?: string;
  companyType?: string;
  companySizeClass?: string;
  cinuCategoryId?: string;
  cinuDivisionId?: string;
}

/**
 * El backend retorna objetos Entity con company/contacts anidados.
 * Estructura: { id (entityId), displayName, province, status, company: { legalName, ... }, contacts: [...] }
 */
export interface CompanyListItem extends Entity {
  company: Company;
  contacts: EntityContact[];
}

export interface CreateCompanyInput {
  legalName: string;
  tradeName?: string;
  ruc?: string;
  dv?: string;
  companyType?: string;
  companySizeClass?: string;
  foundedDate?: string;
  province?: string;
  district?: string;
  corregimiento?: string;
  address?: string;
  notes?: string;
  economicActivity?: string;
  contacts?: Array<{
    contactType: string;
    contactValue: string;
    label?: string;
    isPrimary?: boolean;
  }>;
}

export type UpdateCompanyInput = Partial<CreateCompanyInput>;

export const companiesService = {
  async list(params: CompanyFilters = {}): Promise<{ data: CompanyListItem[]; meta: PaginationMeta }> {
    const res = await apiClient.get<ApiResponse<CompanyListItem[]>>('/companies', { params });
    return { data: res.data.data, meta: res.data.meta! };
  },

  async getById(id: string): Promise<CompanyListItem> {
    const res = await apiClient.get<ApiResponse<CompanyListItem>>(`/companies/${id}`);
    return res.data.data;
  },

  async create(data: CreateCompanyInput): Promise<{ queued: boolean; id: string; message?: string }> {
    const res = await apiClient.post<ApiResponse<{ queued: boolean; id: string; message?: string }>>(
      '/companies',
      data
    );
    return res.data.data;
  },

  async update(id: string, data: UpdateCompanyInput): Promise<{ queued: boolean; id: string; message?: string }> {
    const res = await apiClient.put<ApiResponse<{ queued: boolean; id: string; message?: string }>>(
      `/companies/${id}`,
      data
    );
    return res.data.data;
  },

  async remove(id: string): Promise<{ queued: boolean; id: string; message?: string }> {
    const res = await apiClient.delete<ApiResponse<{ queued: boolean; id: string; message?: string }>>(
      `/companies/${id}`
    );
    return res.data.data;
  },
};
