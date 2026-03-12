/**
 * Servicio de empresas.
 */
import { apiClient } from './api-client';
import type { ApiResponse, PaginationParams, PaginationMeta } from '@/types/api.types';
import type { Entity, Company, EntityContact } from '@/types/entities.types';

export interface CompanyFilters extends PaginationParams {
  status?: string;
  province?: string;
  ruc?: string;
  companyType?: string;
  economicActivity?: string;
}

export interface CompanyListItem {
  entity: Entity & { contacts: EntityContact[] };
  id: string;
  entityId: string;
  ruc: string | null;
  dv: string | null;
  legalName: string;
  tradeName: string | null;
  companyType: string | null;
  economicActivity: string | null;
}

export interface CreateCompanyInput {
  legalName: string;
  tradeName?: string;
  ruc?: string;
  dv?: string;
  companyType?: string;
  economicActivity?: string;
  foundedDate?: string;
  employeeCount?: number;
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

  async create(data: CreateCompanyInput): Promise<CompanyListItem> {
    const res = await apiClient.post<ApiResponse<CompanyListItem>>('/companies', data);
    return res.data.data;
  },

  async update(id: string, data: UpdateCompanyInput): Promise<CompanyListItem> {
    const res = await apiClient.put<ApiResponse<CompanyListItem>>(`/companies/${id}`, data);
    return res.data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/companies/${id}`);
  },
};
