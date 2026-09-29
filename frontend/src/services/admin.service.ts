import { apiClient } from './api-client';
import type { ApiResponse } from '@/types/api.types';
import type { UserRole } from '@/types/auth.types';

export interface Sede {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Departamento {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmUser {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  sede: { id: string; name: string } | null;
  departamento: { id: string; name: string } | null;
}

export const adminService = {
  async listSedes(): Promise<Sede[]> {
    const res = await apiClient.get<ApiResponse<Sede[]>>('/sedes');
    return res.data.data;
  },

  async createSede(name: string): Promise<Sede> {
    const res = await apiClient.post<ApiResponse<Sede>>('/sedes', { name });
    return res.data.data;
  },

  async updateSede(id: string, name: string): Promise<Sede> {
    const res = await apiClient.put<ApiResponse<Sede>>(`/sedes/${id}`, { name });
    return res.data.data;
  },

  async removeSede(id: string): Promise<void> {
    await apiClient.delete(`/sedes/${id}`);
  },

  async listUsers(): Promise<CrmUser[]> {
    const res = await apiClient.get<ApiResponse<CrmUser[]>>('/users');
    return res.data.data;
  },

  async updateUserAssignment(
    userId: string,
    data: { sedeId: string | null; departamentoId: string | null }
  ): Promise<CrmUser> {
    const res = await apiClient.put<ApiResponse<CrmUser>>(`/users/${userId}`, data);
    return res.data.data;
  },

  async listDepartamentos(): Promise<Departamento[]> {
    const res = await apiClient.get<ApiResponse<Departamento[]>>('/departamentos');
    return res.data.data;
  },

  async createDepartamento(name: string): Promise<Departamento> {
    const res = await apiClient.post<ApiResponse<Departamento>>('/departamentos', { name });
    return res.data.data;
  },

  async updateDepartamento(id: string, name: string): Promise<Departamento> {
    const res = await apiClient.put<ApiResponse<Departamento>>(`/departamentos/${id}`, { name });
    return res.data.data;
  },

  async removeDepartamento(id: string): Promise<void> {
    await apiClient.delete(`/departamentos/${id}`);
  },
};
