'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { personsService, type PersonFilters, type CreatePersonInput, type UpdatePersonInput } from '@/services/persons.service';
import { getApiErrorMessage } from '@/services/api-client';
import toast from 'react-hot-toast';

const PERSONS_KEY = 'persons';

export function usePersons(filters: PersonFilters = {}) {
  return useQuery({
    queryKey: [PERSONS_KEY, filters],
    queryFn: () => personsService.list(filters),
  });
}

export function usePerson(id: string | undefined) {
  return useQuery({
    queryKey: [PERSONS_KEY, id],
    queryFn: () => personsService.getById(id!),
    enabled: !!id,
  });
}

export function useCreatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePersonInput) => personsService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PERSONS_KEY] });
      toast.success('Persona creada exitosamente');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err) || 'Error al crear la persona');
    },
  });
}

export function useUpdatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePersonInput }) =>
      personsService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PERSONS_KEY] });
      toast.success('Persona actualizada exitosamente');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err) || 'Error al actualizar la persona');
    },
  });
}

export function useDeletePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => personsService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PERSONS_KEY] });
      toast.success('Persona eliminada');
    },
    onError: () => {
      toast.error('Error al eliminar la persona');
    },
  });
}
