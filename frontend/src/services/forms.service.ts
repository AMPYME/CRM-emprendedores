/**
 * Cliente de formularios AMPYME vía API propia del CRM (MySQL directo).
 */
import { apiClient } from './api-client';
import type { ApiResponse, PaginationParams } from '@/types/api.types';
import type { AmpymeForm, AmpymeFormSubmission, AmpymeFormsListResult } from '@/types/forms.types';

const FORMS_PUBLIC_BASE =
  process.env.NEXT_PUBLIC_FORMS_PUBLIC_URL || 'http://programas.ampyme.gob.pa/forms';

const FORMS_ADMIN_LOGIN_URL =
  process.env.NEXT_PUBLIC_FORMS_ADMIN_LOGIN_URL ||
  'https://programas.ampyme.gob.pa/forms/admin/login/';

export const formsService = {
  async list(): Promise<AmpymeFormsListResult> {
    const res = await apiClient.get<ApiResponse<AmpymeFormsListResult>>('/ampyme-forms');
    return res.data.data ?? { forms: [], source: 'mysql' };
  },

  async getById(id: string): Promise<AmpymeForm | null> {
    try {
      const res = await apiClient.get<ApiResponse<AmpymeForm>>(`/ampyme-forms/${id}`);
      return res.data.data ?? null;
    } catch {
      return null;
    }
  },

  getPublicFormUrl(formId: number | string): string {
    return `${FORMS_PUBLIC_BASE.replace(/\/+$/, '')}/form/?id=${encodeURIComponent(String(formId))}`;
  },

  getAdminLoginUrl(): string {
    return FORMS_ADMIN_LOGIN_URL;
  },

  async listSubmissions(
    formId: string,
    params?: PaginationParams
  ): Promise<ApiResponse<AmpymeFormSubmission[]>> {
    const res = await apiClient.get<ApiResponse<AmpymeFormSubmission[]>>(
      `/ampyme-forms/${formId}/submissions`,
      { params }
    );
    return res.data;
  },
};
