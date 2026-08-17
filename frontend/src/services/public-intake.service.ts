/**
 * Cliente REST público de intake (sin JWT).
 */
import type { IntakeSnapshot } from '@/types/intake.types';
import type { IntakeUpdateInput } from '@/services/intake.service';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export class PublicIntakeError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'PublicIntakeError';
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: { code?: string; message?: string };
}

async function publicRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !body?.success) {
    throw new PublicIntakeError(
      res.status,
      body?.error?.message || `Error ${res.status}`
    );
  }
  return body.data;
}

export interface PublicIntakeSession {
  sessionId: string;
  entityType: IntakeSnapshot['entityType'];
  status: IntakeSnapshot['status'];
  expiresAt: string;
  ttlMinutes: number;
}

export interface PublicIntakeSessionResult {
  session: PublicIntakeSession;
  snapshot: IntakeSnapshot;
}

export const publicIntakeService = {
  getSession(id: string, accessCode: string): Promise<PublicIntakeSessionResult> {
    const qs = new URLSearchParams({ accessCode });
    return publicRequest(`/intake/public/sessions/${encodeURIComponent(id)}?${qs.toString()}`);
  },

  verifyAccess(id: string, accessCode: string): Promise<{ sessionId: string; verified: boolean }> {
    return publicRequest(`/intake/public/sessions/${encodeURIComponent(id)}/verify-access`, {
      method: 'POST',
      body: JSON.stringify({ accessCode }),
    });
  },

  save(id: string, accessCode: string, data: IntakeUpdateInput): Promise<IntakeSnapshot> {
    return publicRequest(`/intake/public/sessions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...data, accessCode }),
    });
  },

  submit(id: string, accessCode: string): Promise<{ sessionId: string; status: string; snapshot: IntakeSnapshot }> {
    return publicRequest(`/intake/public/sessions/${encodeURIComponent(id)}/submit`, {
      method: 'POST',
      body: JSON.stringify({ accessCode }),
    });
  },
};
