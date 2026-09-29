/**
 * Servicio de logs de auditoría (ADMIN).
 */
import { apiClient } from './api-client';
import type { ApiResponse, PaginationParams, PaginationMeta } from '@/types/api.types';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'VERIFICATION_CLAIM'
  | 'VERIFICATION_UPDATE'
  | 'VERIFICATION_VALIDATE'
  | 'VERIFICATION_REJECT';

export interface AuditLog {
  id: string;
  action: AuditAction;
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
  userId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string; username: string | null } | null;
}

export interface AuditLogFilters extends PaginationParams {
  action?: AuditAction;
  entityType?: string;
  userId?: string;
  from?: string;
  to?: string;
}

export const auditService = {
  async list(params: AuditLogFilters = {}): Promise<{ data: AuditLog[]; meta: PaginationMeta }> {
    const res = await apiClient.get<ApiResponse<AuditLog[]>>('/audit', { params });
    return { data: res.data.data, meta: res.data.meta! };
  },
};
