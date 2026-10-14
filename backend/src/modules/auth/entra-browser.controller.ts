import { Request, Response } from 'express';
import { config } from '../../config/environment';
import { proxyEntraCallback, startEntraLogin } from './entra-user-api.client';

const OAUTH_COOKIE = 'emprendedores_oauth';

function readCookie(header: string | undefined, name: string): string {
  if (!header) return '';
  const parts = header.split(';');
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

export const entraBrowserController = {
  /**
   * POST /api/v1/auth/entra/start
   * El navegador envía returnUrl. El clientId sale de EMPRENDEDORES_CLIENT_ID.
   */
  async start(req: Request, res: Response): Promise<void> {
    if (!config.entraApiBaseUrl || !config.entraClientId) {
      res.status(503).json({ error: 'Login central no configurado' });
      return;
    }
    const returnUrl = String(req.body?.returnUrl || '').trim();
    const outcome = await startEntraLogin(config.entraApiBaseUrl, config.entraClientId, returnUrl);
    if (outcome.kind === 'error') {
      res.status(outcome.status).json({ error: outcome.error });
      return;
    }
    if (outcome.oauthCookie) {
      res.append(
        'Set-Cookie',
        `${OAUTH_COOKIE}=${encodeURIComponent(outcome.oauthCookie)}; HttpOnly; Path=/api/v1/auth/entra; Max-Age=600; SameSite=Lax`
      );
    }
    res.redirect(303, outcome.url);
  },

  /**
   * GET /api/v1/auth/entra/callback
   * Microsoft vuelve a esta IP. El backend reenvía code y state al login por DNS.
   */
  async callback(req: Request, res: Response): Promise<void> {
    if (!config.entraApiBaseUrl) {
      res.status(503).json({ error: 'Login central no configurado' });
      return;
    }
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const oauthError = String(req.query.error || '');
    if (oauthError) {
      res.status(401).json({ error: 'Entra canceló el inicio de sesión' });
      return;
    }
    const oauthCookie = readCookie(req.headers.cookie, OAUTH_COOKIE);
    if (!code || !state || !oauthCookie) {
      res.status(400).json({ error: 'falta la correlación del navegador' });
      return;
    }
    const outcome = await proxyEntraCallback(config.entraApiBaseUrl, code, state, oauthCookie);
    if (outcome.kind === 'error') {
      res.status(outcome.status).json({ error: outcome.error });
      return;
    }
    res.redirect(302, outcome.url);
  },
};
