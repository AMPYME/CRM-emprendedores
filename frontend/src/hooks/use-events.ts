'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsService } from '@/services/events.service';
import type { PaginationParams } from '@/types/api.types';
import toast from 'react-hot-toast';

const EVENTS_KEY = 'events';
const REGISTRATIONS_KEY = 'registrations';

export function useEvents(params?: PaginationParams & { status?: string; eventType?: string }) {
  return useQuery({
    queryKey: [EVENTS_KEY, params],
    queryFn: () => eventsService.list(params),
  });
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: [EVENTS_KEY, id],
    queryFn: () => eventsService.getById(id!),
    enabled: !!id,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof eventsService.create>[0]) => eventsService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [EVENTS_KEY] });
      toast.success('Evento creado exitosamente');
    },
    onError: () => {
      toast.error('Error al crear el evento');
    },
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof eventsService.update>[1] }) =>
      eventsService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [EVENTS_KEY] });
      toast.success('Evento actualizado exitosamente');
    },
    onError: () => {
      toast.error('Error al actualizar el evento');
    },
  });
}

export function useEventRegistrations(eventId: string | undefined, params?: PaginationParams) {
  return useQuery({
    queryKey: [REGISTRATIONS_KEY, 'event', eventId, params],
    queryFn: () => eventsService.listRegistrations(eventId!, params),
    enabled: !!eventId,
  });
}

export function useCreateRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, data }: { eventId: string; data: Parameters<typeof eventsService.createRegistration>[1] }) =>
      eventsService.createRegistration(eventId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [REGISTRATIONS_KEY] });
      qc.invalidateQueries({ queryKey: [EVENTS_KEY] });
      toast.success('Inscripción registrada');
    },
    onError: () => {
      toast.error('Error al registrar la inscripción');
    },
  });
}
