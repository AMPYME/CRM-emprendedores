/**
 * Servicio del intake de emprendedores (REST + helpers de WebSocket / enlace).
 */
import { apiHttpUrl, toPageProtocol } from '@/lib/public-urls';
import { apiClient } from './api-client';
import type { ApiResponse } from '@/types/api.types';
import type {
  IntakeSnapshot,
  IntakeSessionListResult,
  IntakeMigrateResult,
  IntakeStatus,
  IntakeEntityType,
  IntakeCreateResult,
} from '@/types/intake.types';

export interface IntakeUpdateInput {
  person?: Record<string, string | boolean | undefined>;
  company?: Record<string, string | undefined>;
  location?: { province?: string; district?: string; corregimiento?: string; address?: string };
  contacts?: Array<{
    contactType: string;
    contactValue: string;
    label?: string;
    isPrimary?: boolean;
  }>;
  notes?: string;
}

export const intakeService = {
  async createSession(entityType: IntakeEntityType): Promise<IntakeCreateResult> {
    const res = await apiClient.post<ApiResponse<IntakeCreateResult>>('/intake/sessions', { entityType });
    return res.data.data;
  },

  async list(status?: IntakeStatus, createdBy?: string): Promise<IntakeSessionListResult> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (createdBy) params.createdBy = createdBy;
    const res = await apiClient.get<ApiResponse<IntakeSessionListResult>>('/intake/sessions', {
      params: Object.keys(params).length ? params : undefined,
    });
    return res.data.data;
  },

  async getById(id: string, accessCode?: string): Promise<IntakeSnapshot> {
    const res = await apiClient.get<ApiResponse<IntakeSnapshot>>(`/intake/sessions/${id}`, {
      params: accessCode ? { accessCode } : undefined,
    });
    return res.data.data;
  },

  async verifyAccess(id: string, accessCode: string): Promise<void> {
    await apiClient.post(`/intake/sessions/${id}/verify-access`, { accessCode });
  },

  async regenerateAccessCode(id: string): Promise<{ sessionId: string; accessCode: string }> {
    const res = await apiClient.post<ApiResponse<{ sessionId: string; accessCode: string }>>(
      `/intake/sessions/${id}/regenerate-access-code`,
      {}
    );
    return res.data.data;
  },

  async validate(id: string, accessCode?: string): Promise<IntakeMigrateResult> {
    const res = await apiClient.post<ApiResponse<IntakeMigrateResult>>(
      `/intake/sessions/${id}/validate`,
      accessCode ? { accessCode } : {}
    );
    return res.data.data;
  },

  async update(id: string, data: IntakeUpdateInput, accessCode?: string): Promise<IntakeSnapshot> {
    const res = await apiClient.patch<ApiResponse<IntakeSnapshot>>(`/intake/sessions/${id}`, {
      ...data,
      ...(accessCode ? { accessCode } : {}),
    });
    return res.data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/intake/sessions/${id}`);
  },
};

function intakeWsBase(): string {
  const explicit = process.env.NEXT_PUBLIC_WS_URL;
  const raw = explicit
    ? explicit.replace(/\/$/, '')
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1')
        .replace(/\/api\/v1\/?$/, '') + '/ws/intake';
  const httpUrl = apiHttpUrl(raw.replace(/^wss:/i, 'https:'));
  return httpUrl.replace(/^http/i, 'ws');
}

/** URL del WebSocket de intake para operadores (JWT como query param). */
export function getIntakeWsUrl(): string {
  const base = intakeWsBase();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

/** URL del WebSocket público (sin JWT; sid + código en query). */
export function getPublicIntakeWsUrl(sessionId: string, accessCode: string): string {
  const params = new URLSearchParams({ sid: sessionId, accessCode });
  return `${intakeWsBase()}?${params.toString()}`;
}

/** Enlace público del formulario de intake (sin login). */
export function getIntakeFormUrl(sessionId: string): string {
  const configured = (process.env.NEXT_PUBLIC_INTAKE_FORM_URL || '').trim();
  let base: string;
  if (configured) {
    base = toPageProtocol(configured.replace(/\/?$/, '/'));
  } else if (typeof window !== 'undefined') {
    base = `${window.location.origin}/emprendedores/`;
  } else {
    base = '/emprendedores/';
  }
  return `${base}?sid=${encodeURIComponent(sessionId)}`;
}

export function intakeAccessCodeKey(sessionId: string): string {
  return `intake-access-code:${sessionId}`;
}
