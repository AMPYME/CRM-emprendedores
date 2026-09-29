/**
 * Controller del módulo de salud.
 * Endpoints para verificar que el servidor y la BD están vivos.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { sendSuccess } from '../../shared/utils/response.utils';
import { appState } from '../../shared/state/app-state';

export const healthController = {
  /**
   * GET /api/v1/health
   * Verificación básica del servidor.
   */
  check(_req: Request, res: Response): void {
    sendSuccess(res, {
      status: appState.isDatabaseConnected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: appState.isDatabaseConnected ? 'connected' : 'disconnected',
      version: '1.0.0',
    });
  },

  /**
   * GET /api/v1/health/db
   * Verificación de conexión a base de datos.
   */
  async checkDatabase(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const start = Date.now();
      await prisma.$executeRawUnsafe('CALL public.sp_db_ping()');
      const latency = Date.now() - start;

      sendSuccess(res, {
        status: 'ok',
        database: 'connected',
        latencyMs: latency,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Responder con 503 si la BD no está disponible
      res.status(503).json({
        success: false,
        data: null,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'No se puede conectar a la base de datos',
          details: {
            hint: 'Verifica que PostgreSQL esté corriendo y que DATABASE_URL sea correcta',
          },
        },
      });
    }
  },
};
