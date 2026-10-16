import { Request, Response } from 'express';
import { config } from '../../config/environment';
import { completeEntraCallback, startEntraLogin } from './entra-user-api.client';

const OAUTH_COOKIE = 'emprendedores_oauth';

export const entraBrowserController = {
  /**
   * POST /api/v1/auth/entra/start
   * El navegador envía returnUrl. El clientId sale de EMPRENDEDORES_CLIENT_ID.
   */
  async start(req: Request, res: Response): Promise<void> {
    if (!config.entraApiBaseUrl || !config.entraClientId || !config.entraClientSecret) {
      res.status(503).json({ error: 'Login central no configurado' });
      return;
    }
    const returnUrl = String(req.body?.returnUrl || '').trim();
    const outcome = await startEntraLogin(
      config.entraApiBaseUrl,
      config.entraClientId,
      config.entraClientSecret,
      returnUrl
    );
    if (outcome.kind === 'error') {
      res.status(outcome.status).json({ error: outcome.error });
      return;
    }
    if (outcome.oauthCookie) {
      res.append(
        'Set-Cookie',
        `${OAUTH_COOKIE}=${encodeURIComponent(outcome.oauthCookie)}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`
      );
    }
    const accept = req.get('accept') || '';
    if (req.is('application/json') || accept.includes('application/json')) {
      res.status(200).json({ url: outcome.url });
      return;
    }
    res.redirect(303, outcome.url);
  },

  /**
   * GET /api/v1/auth/entra/callback
   * Microsoft vuelve a esta IP. Este backend cierra la sesión con ENTRA por DNS.
   */
  async callback(req: Request, res: Response): Promise<void> {
    if (!config.entraApiBaseUrl || !config.entraClientId || !config.entraClientSecret) {
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
    if (!code || !state) {
      res.status(400).json({ error: 'faltan code o state' });
      return;
    }
    const outcome = await completeEntraCallback(
      config.entraApiBaseUrl,
      config.entraClientId,
      config.entraClientSecret,
      code,
      state
    );
    if (outcome.kind === 'error') {
      res.status(outcome.status).json({ error: outcome.error });
      return;
    }
    res.redirect(302, outcome.url);
  },
};
