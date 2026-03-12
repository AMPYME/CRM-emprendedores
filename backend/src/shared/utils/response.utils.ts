/**
 * Helpers para construir respuestas estándar de la API.
 */
import { Response } from 'express';
import { ApiResponse, PaginationMeta } from '../types/api-response.types';

/**
 * Respuesta exitosa simple.
 */
export function sendSuccess<T>(res: Response, data: T, statusCode: number = 200): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  res.status(statusCode).json(response);
}

/**
 * Respuesta exitosa con paginación.
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
  statusCode: number = 200
): void {
  const response: ApiResponse<T[]> = {
    success: true,
    data,
    meta,
  };
  res.status(statusCode).json(response);
}

/**
 * Respuesta de creación exitosa (201).
 */
export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, 201);
}

/**
 * Respuesta sin contenido (204).
 */
export function sendNoContent(res: Response): void {
  res.status(204).send();
}
