/**
 * Utilidades de paginación.
 * Parsea query params y construye metadatos de paginación.
 */
import { PaginationParams, PaginationMeta } from '../types/api-response.types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parsea y normaliza parámetros de paginación desde query string.
 */
export function parsePaginationParams(query: Record<string, unknown>): PaginationParams {
  const page = Math.max(1, parseInt(String(query.page || DEFAULT_PAGE), 10));
  const rawLimit = parseInt(String(query.limit || DEFAULT_LIMIT), 10);
  const limit = Math.min(Math.max(1, rawLimit), MAX_LIMIT);
  const sortBy = typeof query.sortBy === 'string' ? query.sortBy : undefined;
  const sortOrder =
    typeof query.sortOrder === 'string' && ['asc', 'desc'].includes(query.sortOrder)
      ? (query.sortOrder as 'asc' | 'desc')
      : 'desc';
  const search = typeof query.search === 'string' ? query.search.trim() : undefined;

  return { page, limit, sortBy, sortOrder, search };
}

/**
 * Construye metadatos de paginación para la respuesta.
 */
export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/**
 * Calcula el offset para la query SQL/Prisma.
 */
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}
