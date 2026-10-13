/**
 * Webhook de revocación desde ENTRA-userAPI.
 * POST /auth/entra-revoke — autenticado con HMAC (X-Ampyme-Signature).
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';
import { config } from '../../config/environment';
import { authService } from './auth.service';
import { UnauthorizedError, BadRequestError } from '../../shared/errors/app-error';
import { sendSuccess } from '../../shared/utils/response.utils';
import { logger } from '../../shared/logger/logger';

type RevokeBody = {
  event?: string;
  sessionRef?: string;
  userId?: string;
  idempotencyKey?: string;
};

const seenKeys = new Map<string, number>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function pruneIdempotency(): void {
  const now = Date.now();
  for (const [k, exp] of seenKeys) {
    if (exp <= now) seenKeys.delete(k);
  }
}

function verifySignature(rawBody: Buffer, header: string | undefined, secret: string): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = header.slice('sha256='.length).trim();
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(provided, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function handleEntraRevokeWebhook(req: Request, res: Response): Promise<void> {
  const secret = config.entraRevokeWebhookSecret;
  if (!secret) {
    throw new UnauthorizedError('Webhook de revocación no configurado');
  }

  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  const bodyBuf = raw ?? Buffer.from(JSON.stringify(req.body ?? {}));
  const sig = req.header('X-Ampyme-Signature') || undefined;
  if (!verifySignature(bodyBuf, sig, secret)) {
    throw new UnauthorizedError('Firma de webhook inválida');
  }

  const body = req.body as RevokeBody;
  if (body.event && body.event !== 'session.revoked') {
    throw new BadRequestError('Evento no soportado');
  }
  const sessionRef = typeof body.sessionRef === 'string' ? body.sessionRef.trim() : '';
  if (!sessionRef) {
    throw new BadRequestError('sessionRef requerido');
  }

  const idem =
    (typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()) ||
    req.header('Idempotency-Key') ||
    '';
  pruneIdempotency();
  if (idem && seenKeys.has(idem)) {
    sendSuccess(res, { revoked: [], duplicate: true });
    return;
  }

  const sids = await authService.revokeByEntraSessionRef(sessionRef);
  if (idem) {
    seenKeys.set(idem, Date.now() + IDEMPOTENCY_TTL_MS);
  }
  logger.info('Webhook ENTRA: sesiones CRM revocadas', {
    count: sids.length,
    // no loguear sessionRef completo si se considera sensible; acortar
    sessionRefPrefix: sessionRef.slice(0, 8),
  });
  sendSuccess(res, { revoked: sids.length, sessionIds: sids });
}
