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

  // ── Middlewares de seguridad ───────────────────────────────────
  app.use(helmet());
  // Soporta múltiples orígenes separados por coma en CORS_ORIGIN
  const allowedOrigins = config.corsOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
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
      skip: (req) => req.path.includes('/intake/public'),
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
