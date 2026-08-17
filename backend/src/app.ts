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

export function createApp(): Application {
  const app = express();

  // Traefik/Dokploy envían X-Forwarded-For. Sin esto, express-rate-limit v7
  // rechaza todas las peticiones (el login parece “no funcionar”).
  app.set('trust proxy', 1);

  // ── Middlewares de seguridad ───────────────────────────────────
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  const allowedOrigins = config.corsOrigin
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }
        const normalized = origin.replace(/\/$/, '');
        if (allowedOrigins.includes(normalized)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );
  app.use(
    rateLimit({
      windowMs: config.rateLimitWindowMs,
      max: config.rateLimitMaxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      validate: { xForwardedForHeader: false },
      skip: (req) => {
        const p = req.path;
        return (
          p.includes('/intake/public') ||
          p.includes('/health') ||
          p.includes('/auth/login') ||
          p.includes('/auth/refresh')
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
