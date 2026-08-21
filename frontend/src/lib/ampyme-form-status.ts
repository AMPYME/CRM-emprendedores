import type { AmpymeForm, AmpymeFormStatus } from '@/types/forms.types';

function parseBackendDate(dateValue?: string | null): Date | null {
  if (!dateValue) return null;
  let s = dateValue.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
    s = s.replace(' ', 'T');
  }
  s = s.replace(/Z$/, '');
  s = s.replace(/([+-]\d{2}:\d{2})$/, '');
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function computeAmpymeFormStatus(form: AmpymeForm): AmpymeFormStatus {
  const now = new Date();
  const expiresAt = parseBackendDate(form.expires_at);
  const openAt = parseBackendDate(form.open_at);

  if (form.is_closed) return 'closed';
  if (form.is_draft) return 'draft';
  if (openAt && openAt > now) return 'future_open';
  if (expiresAt && expiresAt < now) return 'expired';
  return 'active';
}

export const ampymeFormStatusLabels: Record<AmpymeFormStatus, string> = {
  active: 'Activo',
  draft: 'Borrador',
  future_open: 'Próxima apertura',
  closed: 'Cerrado',
  expired: 'Expirado',
};

export const ampymeFormStatusBadge: Record<
  AmpymeFormStatus,
  'default' | 'primary' | 'success' | 'warning' | 'danger'
> = {
  active: 'success',
  draft: 'default',
  future_open: 'primary',
  closed: 'warning',
  expired: 'danger',
};

export function isFormOpen(form: AmpymeForm): boolean {
  return !form.is_closed && !form.is_draft;
}

export function filterAmpymeFormsByStatus(
  forms: AmpymeForm[],
  statusFilter: string
): AmpymeForm[] {
  if (!statusFilter || statusFilter === 'all') return forms;

  return forms.filter((form) => {
    const status = computeAmpymeFormStatus(form);
    if (statusFilter === 'open') {
      return !form.is_closed && !form.is_draft;
    }
    return status === statusFilter;
  });
}
