'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  establishmentsService,
  type EstablishmentFilters,
  type CreateEstablishmentInput,
  type UpdateEstablishmentInput,
} from '@/services/establishments.service';
import toast from 'react-hot-toast';

const ESTABLISHMENTS_KEY = 'establishments';

export function useEstablishments(filters: EstablishmentFilters = {}) {
  return useQuery({
    queryKey: [ESTABLISHMENTS_KEY, filters],
    queryFn: () => establishmentsService.list(filters),
  });
}

export function useEstablishment(id: string | undefined) {
  return useQuery({
    queryKey: [ESTABLISHMENTS_KEY, id],
    queryFn: () => establishmentsService.getById(id!),
    enabled: !!id,
  });
}

export function useCreateEstablishment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEstablishmentInput) => establishmentsService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ESTABLISHMENTS_KEY] });
      toast.success('Establecimiento creado exitosamente');
    },
    onError: () => {
      toast.error('Error al crear el establecimiento');
    },
  });
}

export function useUpdateEstablishment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEstablishmentInput }) =>
      establishmentsService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ESTABLISHMENTS_KEY] });
      toast.success('Establecimiento actualizado exitosamente');
    },
    onError: () => {
      toast.error('Error al actualizar el establecimiento');
    },
  });
}

export function useDeleteEstablishment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => establishmentsService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ESTABLISHMENTS_KEY] });
      toast.success('Establecimiento eliminado');
    },
    onError: () => {
      toast.error('Error al eliminar el establecimiento');
    },
  });
}
