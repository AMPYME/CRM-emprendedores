import { apiClient } from './api-client';
import type { ApiResponse } from '@/types/api.types';

export interface DemographicSlice {
  key: string;
  label: string;
  total: number;
}

export interface PersonDemographics {
  gender: DemographicSlice[];
  age: DemographicSlice[];
  foreigner: DemographicSlice[];
  artisan: DemographicSlice[];
}

export const demographicsService = {
  async get(): Promise<PersonDemographics> {
    const res = await apiClient.get<ApiResponse<PersonDemographics>>('/stats/demographics');
    return res.data.data;
  },
};
