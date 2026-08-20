import { apiClient } from './api-client';
import type { ApiResponse } from '@/types/api.types';

export type VerificationSource = 'IMPORT' | 'FIELD';
export type VerificationStatus = 'PENDING' | 'ASSIGNED' | 'IN_REVIEW' | 'VALIDATED' | 'REJECTED';
export type VerificationAssignment = 'all' | 'unassigned' | 'mine' | 'others';

export interface VerificationListItem {
  id: string;
  entityType: 'PERSON' | 'COMPANY';
  source: VerificationSource;
  status: VerificationStatus;
  displayName: string | null;
  searchCedula: string | null;
  searchRuc: string | null;
  province: string | null;
  district: string | null;
  corregimiento: string | null;
  importBatchId: string | null;
  importFileName: string | null;
  stagingRowId: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  intakeSessionId: string | null;
  validatedEntityId: string | null;
  validatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationQuery {
  page?: number;
  limit?: number;
  search?: string;
  entityType?: 'PERSON' | 'COMPANY';
  source?: VerificationSource;
  status?: VerificationStatus;
  assignment?: VerificationAssignment;
  provinceId?: string;
  districtId?: string;
  corregimientoId?: string;
  importId?: string;
}

export const verificationService = {
  async list(params: VerificationQuery = {}) {
    const cleanParams: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      cleanParams[key] = value as string | number;
    }
    const res = await apiClient.get<{ data: VerificationListItem[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      '/verifications',
      { params: cleanParams }
    );
    return res.data;
  },

  async claim(id: string) {
    const res = await apiClient.post<{ data: { verificationId: string; intakeSessionId: string; accessCode: string; status: VerificationStatus } }>(
      `/verifications/${id}/claim`
    );
    return res.data.data;
  },

  async validate(id: string) {
    const res = await apiClient.post<ApiResponse<{ verificationId: string; entities: Array<{ id: string; entityType: string; displayName: string }> }>>(
      `/verifications/${id}/validate`
    );
    return res.data.data;
  },

  async reject(id: string, reason: string) {
    const res = await apiClient.post<ApiResponse<{ rejected: boolean }>>(`/verifications/${id}/reject`, { reason });
    return res.data.data;
  },
};