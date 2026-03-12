'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companiesService, type CompanyFilters, type CreateCompanyInput, type UpdateCompanyInput } from '@/services/companies.service';
import toast from 'react-hot-toast';

const COMPANIES_KEY = 'companies';

export function useCompanies(filters: CompanyFilters = {}) {
  return useQuery({
    queryKey: [COMPANIES_KEY, filters],
    queryFn: () => companiesService.list(filters),
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
      toast.success('Empresa creada exitosamente');
    },
    onError: () => {
      toast.error('Error al crear la empresa');
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
      toast.success('Empresa actualizada exitosamente');
    },
    onError: () => {
      toast.error('Error al actualizar la empresa');
    },
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => companiesService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [COMPANIES_KEY] });
      toast.success('Empresa eliminada');
    },
    onError: () => {
      toast.error('Error al eliminar la empresa');
    },
  });
}
