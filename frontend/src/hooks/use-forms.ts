'use client';

import { useQuery } from '@tanstack/react-query';
import { formsService } from '@/services/forms.service';
import type { PaginationParams } from '@/types/api.types';

const FORMS_KEY = 'ampyme-forms';

export function useAmpymeForms() {
  return useQuery({
    queryKey: [FORMS_KEY, 'list'],
    queryFn: () => formsService.list(),
  });
}

export function useAmpymeForm(id: string | undefined) {
  return useQuery({
    queryKey: [FORMS_KEY, id],
    queryFn: () => formsService.getById(id!),
    enabled: !!id,
  });
}

export function useAmpymeFormSubmissions(
  formId: string | undefined,
  params?: PaginationParams
) {
  return useQuery({
    queryKey: [FORMS_KEY, formId, 'submissions', params],
    queryFn: () => formsService.listSubmissions(formId!, params),
    enabled: !!formId,
  });
}
