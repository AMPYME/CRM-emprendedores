/**
 * Configuración principal de la aplicación Express.
 * Registra middlewares globales y monta las rutas de cada módulo.
 */
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config } from './config/environment';
import { errorHandler } from './shared/middlewares/error-handler.middleware';
import { notFoundHandler } from './shared/middlewares/not-found.middleware';
import { apiRouter } from './routes';

/** En desarrollo acepta localhost y redes privadas (otros PC en la LAN / WSL). */
function isPrivateDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

export function createApp(): Application {
  const app = express();
  app.set('etag', false);

  // Detrás de reverse proxy (Dokploy/Traefik) para rate-limit por IP real
  app.set('trust proxy', 1);

  // ── Middlewares de seguridad ───────────────────────────────────
  app.use(helmet());
  // Soporta múltiples orígenes separados por coma en CORS_ORIGIN
  const allowedOrigins = config.corsOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const originAllowed = (origin: string | undefined): boolean => {
    if (!origin) return true;
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return true;
    if (config.nodeEnv !== 'production' && isPrivateDevOrigin(origin)) return true;
    const alt = origin.startsWith('https://')
      ? `http://${origin.slice('https://'.length)}`
      : origin.startsWith('http://')
        ? `https://${origin.slice('http://'.length)}`
        : origin;
    return allowedOrigins.includes(alt);
  };

  app.use(
    cors({
      origin(origin, callback) {
        if (originAllowed(origin)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
    })
  );
  app.use(
    rateLimit({
      windowMs: config.rateLimitWindowMs,
      max: config.rateLimitMaxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT',
          message: 'Demasiadas peticiones. Espere un momento e intente de nuevo.',
        },
      },
      skip: (req) => {
        const p = req.path || '';
        return (
          p.includes('/health') ||
          p.endsWith('/health') ||
          p.includes('/intake/public')
        );
      },
    })
  );

  // ── Middlewares de parsing ────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(compression());

  // ── Logging HTTP ──────────────────────────────────────────────
  if (config.nodeEnv !== 'test') {
    app.use(morgan('combined'));
  }

  // ── Rutas ─────────────────────────────────────────────────────
  app.use(config.apiPrefix, apiRouter);

  // ── Manejo de errores ─────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
