'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companiesService, type CompanyFilters, type CreateCompanyInput, type UpdateCompanyInput } from '@/services/companies.service';
import { getApiErrorMessage } from '@/services/api-client';
import toast from 'react-hot-toast';

const COMPANIES_KEY = 'companies';

export function useCompanies(filters: CompanyFilters = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [COMPANIES_KEY, filters],
    queryFn: () => companiesService.list(filters),
    enabled: options?.enabled ?? true,
  });
}

export function useCompany(id: string | undefined) {
  return useQuery({
    queryKey: [COMPANIES_KEY, id],
    queryFn: () => companiesService.getById(id!),
    enabled: !!id,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCompanyInput) => companiesService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [COMPANIES_KEY] });
      qc.invalidateQueries({ queryKey: ['person-change-requests'] });
      toast.success('Cambio pendiente de confirmación. Revise Confirmación.');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err) || 'Error al encolar la creación');
    },
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCompanyInput }) =>
      companiesService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [COMPANIES_KEY] });
      qc.invalidateQueries({ queryKey: ['person-change-requests'] });
      toast.success('Cambio pendiente de confirmación. Revise Confirmación.');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err) || 'Error al encolar la actualización');
    },
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => companiesService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [COMPANIES_KEY] });
      qc.invalidateQueries({ queryKey: ['person-change-requests'] });
      toast.success('Eliminación pendiente de confirmación. Revise Confirmación.');
    },
    onError: () => {
      toast.error('Error al encolar la eliminación');
    },
  });
}
