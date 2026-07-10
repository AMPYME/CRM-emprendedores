'use client';

import { createElement } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import axios from 'axios';
import { intakeService, type IntakeUpdateInput } from '@/services/intake.service';
import { getApiErrorMessage, getApiErrorDetails } from '@/services/api-client';
import type {
  IntakeStatus,
  IntakeEntityType,
  IntakeSessionListResult,
} from '@/types/intake.types';

const INTAKE_KEY = 'intake-sessions';

function entityPath(type: string, id: string): string {
  if (type === 'PERSON') return `/dashboard/persons/${id}`;
  if (type === 'COMPANY') return `/dashboard/companies/${id}`;
  return `/dashboard/establishments/${id}`;
}

export function useIntakeSessions(
  status?: IntakeStatus,
  createdBy?: string,
  options?: { refetchInterval?: number }
) {
  return useQuery({
    queryKey: [INTAKE_KEY, status ?? 'all', createdBy ?? 'all-creators'],
    queryFn: (): Promise<IntakeSessionListResult> => intakeService.list(status, createdBy),
    refetchInterval: options?.refetchInterval ?? 5000,
  });
}

export function useIntakeSession(id: string | undefined, accessCode: string | undefined) {
  return useQuery({
    queryKey: [INTAKE_KEY, 'detail', id, accessCode ?? 'no-code'],
    queryFn: () => intakeService.getById(id!, accessCode!),
    enabled: !!id && !!accessCode,
  });
}

export function useCreateIntakeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entityType: IntakeEntityType) => intakeService.createSession(entityType),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [INTAKE_KEY] });
      toast.success('Sesión creada. Comparte el enlace con el emprendedor.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useRegenerateIntakeAccessCode() {
  return useMutation({
    mutationFn: (id: string) => intakeService.regenerateAccessCode(id),
    onSuccess: () => {
      toast.success('Se generó un nuevo código de acceso.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useVerifyIntakeAccess() {
  return useMutation({
    mutationFn: ({ id, accessCode }: { id: string; accessCode: string }) =>
      intakeService.verifyAccess(id, accessCode),
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUpdateIntakeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data, accessCode }: { id: string; data: IntakeUpdateInput; accessCode: string }) =>
      intakeService.update(id, data, accessCode),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: [INTAKE_KEY] });
      qc.invalidateQueries({ queryKey: [INTAKE_KEY, 'detail', id] });
      toast.success('Sesión actualizada en borrador.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useDeleteIntakeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => intakeService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [INTAKE_KEY] });
      toast.success('Sesión eliminada.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useValidateIntakeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accessCode }: { id: string; accessCode: string }) =>
      intakeService.validate(id, accessCode),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: [INTAKE_KEY] });
      toast.success(`Datos validados y guardados (${result.entities.length} registro(s)).`);
    },
    onError: (err) => {
      const msg = getApiErrorMessage(err);
      const details = getApiErrorDetails(err);
      if (axios.isAxiosError(err) && err.response?.status === 409 && details?.existingEntityId) {
        const path = entityPath(String(details.entityType || 'PERSON'), String(details.existingEntityId));
        toast.error(
          (t) =>
            createElement(
              'span',
              null,
              msg,
              ' ',
              createElement(
                'a',
                {
                  href: path,
                  className: 'font-semibold underline',
                  onClick: () => toast.dismiss(t.id),
                },
                'Ver registro existente'
              )
            ),
          { duration: 8000 }
        );
        return;
      }
      toast.error(msg);
    },
  });
}
