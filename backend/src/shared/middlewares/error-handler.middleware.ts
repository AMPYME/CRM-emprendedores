/**
 * Middleware global de manejo de errores.
 * Captura errores lanzados en cualquier punto de la cadena y
 * responde con el formato estándar de la API.
 */
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error';
import { logger } from '../logger/logger';
import { ApiResponse } from '../types/api-response.types';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Si es un error controlado de la aplicación
  if (err instanceof AppError) {
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    };

    if (err.statusCode >= 500) {
      logger.error(`[${err.code}] ${err.message}`, { stack: err.stack });
    } else {
      logger.warn(`[${err.code}] ${err.message}`);
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Error no controlado
  logger.error('Error no controlado:', { message: err.message, stack: err.stack });

  const response: ApiResponse<null> = {
    success: false,
    data: null,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'Error interno del servidor'
          : err.message,
    },
  };

  res.status(500).json(response);
}
