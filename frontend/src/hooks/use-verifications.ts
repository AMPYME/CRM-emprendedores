import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { verificationService, type VerificationQuery } from '@/services/verification.service';
import { importsService } from '@/services/imports.service';
import { getApiErrorMessage } from '@/services/api-client';

export function useVerifications(params: VerificationQuery) {
  return useQuery({
    queryKey: ['verifications', params],
    queryFn: () => verificationService.list(params),
    refetchInterval: 45_000,
  });
}

export function useClaimVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => verificationService.claim(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['verifications'] });
    },
  });
}

export function useValidateVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => verificationService.validate(id),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['verifications'] });
      qc.invalidateQueries({ queryKey: ['persons'] });
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['intake-sessions'] });
      const n = result.entities?.length ?? 0;
      toast.success(
        n > 0
          ? `Validado y guardado en el CRM (${n} registro(s)).`
          : 'Validado y guardado en el CRM.'
      );
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}

export function useRejectVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      verificationService.reject(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['verifications'] });
    },
  });
}

export function useReleaseVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => verificationService.release(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['verifications'] });
      qc.invalidateQueries({ queryKey: ['intake-sessions'] });
      toast.success('Asignación liberada');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}

export function useReleaseAllVerifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => verificationService.releaseAll(),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['verifications'] });
      qc.invalidateQueries({ queryKey: ['intake-sessions'] });
      toast.success(
        result.released > 0
          ? `Se liberaron ${result.released} asignación(es)`
          : 'No había asignaciones para liberar'
      );
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}

export function useSendImportToVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (importId: string) => importsService.sendToVerification(importId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['imports'] });
      qc.invalidateQueries({ queryKey: ['verifications'] });
    },
  });
}
