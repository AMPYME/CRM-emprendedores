'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { portfolioService } from '@/services/portfolio.service';
import type { PaginationParams } from '@/types/api.types';
import toast from 'react-hot-toast';

const PORTFOLIO_KEY = 'portfolio';
const PORTFOLIO_ACTIONS_KEY = 'portfolio-actions';
const PORTFOLIO_STATS_KEY = 'portfolio-stats';

export function usePortfolios(params?: PaginationParams & { status?: string; priority?: string }) {
  return useQuery({
    queryKey: [PORTFOLIO_KEY, params],
    queryFn: () => portfolioService.list(params),
  });
}

export function usePortfolio(id: string | undefined) {
  return useQuery({
    queryKey: [PORTFOLIO_KEY, id],
    queryFn: () => portfolioService.getById(id!),
    enabled: !!id,
  });
}

export function usePortfolioStats() {
  return useQuery({
    queryKey: [PORTFOLIO_STATS_KEY],
    queryFn: () => portfolioService.getStats(),
    staleTime: 30 * 1000,
  });
}

export function useCreatePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof portfolioService.create>[0]) => portfolioService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PORTFOLIO_KEY] });
      qc.invalidateQueries({ queryKey: [PORTFOLIO_STATS_KEY] });
      toast.success('Registro de cartera creado');
    },
    onError: () => {
      toast.error('Error al crear el registro');
    },
  });
}

export function useUpdatePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof portfolioService.update>[1] }) =>
      portfolioService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PORTFOLIO_KEY] });
      qc.invalidateQueries({ queryKey: [PORTFOLIO_STATS_KEY] });
      toast.success('Registro actualizado');
    },
    onError: () => {
      toast.error('Error al actualizar el registro');
    },
  });
}

export function usePortfolioActions(portfolioId: string | undefined) {
  return useQuery({
    queryKey: [PORTFOLIO_ACTIONS_KEY, portfolioId],
    queryFn: () => portfolioService.listActions(portfolioId!),
    enabled: !!portfolioId,
  });
}

export function useAddPortfolioAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ portfolioId, data }: { portfolioId: string; data: Parameters<typeof portfolioService.addAction>[1] }) =>
      portfolioService.addAction(portfolioId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PORTFOLIO_ACTIONS_KEY] });
      qc.invalidateQueries({ queryKey: [PORTFOLIO_KEY] });
      toast.success('Acción registrada');
    },
    onError: () => {
      toast.error('Error al registrar la acción');
    },
  });
}

export function useEntityPortfolios(entityId: string | undefined) {
  return useQuery({
    queryKey: [PORTFOLIO_KEY, 'entity', entityId],
    queryFn: () => portfolioService.listByEntity(entityId!),
    enabled: !!entityId,
  });
}
