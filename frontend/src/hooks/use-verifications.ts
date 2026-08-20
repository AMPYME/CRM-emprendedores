import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { verificationService, type VerificationQuery } from '@/services/verification.service';
import { importsService } from '@/services/imports.service';

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['verifications'] });
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
