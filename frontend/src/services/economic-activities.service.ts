/**
 * Catálogo CINU 4.1 y actividades económicas por entidad.
 */
import { apiClient } from './api-client';
import type { ApiResponse } from '@/types/api.types';

export interface CinuOption {
  id: string;
  code: string;
  name: string;
  versionId?: string;
  versionCode?: string;
  categoryId?: string;
  divisionId?: string;
  groupId?: string;
  classId?: string;
}

export interface EconomicActivitySearchHit {
  level: 'clase' | 'subclase' | string;
  id: string;
  code: string;
  name: string;
  classId: string;
  classCode: string;
  className: string;
  groupCode: string;
  divisionCode: string;
  categoryCode: string;
  versionCode: string;
}

export interface EntityEconomicActivity {
  id: string;
  entityId: string;
  cinuClassId: string;
  cinuSubclassId: string | null;
  isPrimary: boolean;
  specificActivity: string | null;
  hasNoticeOfOperation: boolean | null;
  classCode: string;
  className: string;
  subclassCode: string | null;
  subclassName: string | null;
  groupCode: string;
  groupName: string;
  divisionCode: string;
  divisionName: string;
  categoryCode: string;
  categoryName: string;
  versionCode: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export const economicActivitiesService = {
  async listCategories(): Promise<CinuOption[]> {
    const res = await apiClient.get<ApiResponse<CinuOption[]>>('/economic-activities/categories');
    return res.data.data;
  },

  async listDivisions(categoryId: string): Promise<CinuOption[]> {
    const res = await apiClient.get<ApiResponse<CinuOption[]>>('/economic-activities/divisions', {
      params: { category_id: categoryId },
    });
    return res.data.data;
  },

  async listGroups(divisionId: string): Promise<CinuOption[]> {
    const res = await apiClient.get<ApiResponse<CinuOption[]>>('/economic-activities/groups', {
      params: { division_id: divisionId },
    });
    return res.data.data;
  },

  async listClasses(groupId: string): Promise<CinuOption[]> {
    const res = await apiClient.get<ApiResponse<CinuOption[]>>('/economic-activities/classes', {
      params: { group_id: groupId },
    });
    return res.data.data;
  },

  async listSubclasses(classId: string): Promise<CinuOption[]> {
    const res = await apiClient.get<ApiResponse<CinuOption[]>>('/economic-activities/subclasses', {
      params: { class_id: classId },
    });
    return res.data.data;
  },

  async search(q: string, limit = 20): Promise<EconomicActivitySearchHit[]> {
    const res = await apiClient.get<ApiResponse<EconomicActivitySearchHit[]>>(
      '/economic-activities/search',
      { params: { q, limit } }
    );
    return res.data.data;
  },

  async listByEntity(entityId: string): Promise<EntityEconomicActivity[]> {
    const res = await apiClient.get<ApiResponse<EntityEconomicActivity[]>>(
      `/entities/${entityId}/economic-activities`
    );
    return res.data.data;
  },

  async assign(
    entityId: string,
    data: {
      cinuClassId: string;
      cinuSubclassId?: string | null;
      isPrimary?: boolean;
      specificActivity?: string | null;
      hasNoticeOfOperation?: boolean | null;
    }
  ): Promise<EntityEconomicActivity> {
    const res = await apiClient.post<ApiResponse<EntityEconomicActivity>>(
      `/entities/${entityId}/economic-activities`,
      data
    );
    return res.data.data;
  },

  async setPrimary(entityId: string, activityId: string): Promise<EntityEconomicActivity> {
    const res = await apiClient.patch<ApiResponse<EntityEconomicActivity>>(
      `/entities/${entityId}/economic-activities/${activityId}`,
      { isPrimary: true }
    );
    return res.data.data;
  },

  async remove(entityId: string, activityId: string): Promise<EntityEconomicActivity> {
    const res = await apiClient.delete<ApiResponse<EntityEconomicActivity>>(
      `/entities/${entityId}/economic-activities/${activityId}`
    );
    return res.data.data;
  },
};
