/**
 * Middleware para rutas no encontradas.
 * Responde 404 para cualquier ruta que no coincida con las registradas.
 */
import { Request, Response } from 'express';
import { ApiResponse } from '../types/api-response.types';

export function notFoundHandler(req: Request, res: Response): void {
  const response: ApiResponse<null> = {
    success: false,
    data: null,
    error: {
      code: 'NOT_FOUND',
      message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    },
  };

  res.status(404).json(response);
}
