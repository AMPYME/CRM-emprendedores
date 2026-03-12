/**
 * Service del módulo de entidades.
 * Lógica de negocio para búsqueda cross-type y detalle.
 */
import { entityRepository } from './entity.repository';
import { EntityQueryInput } from './entity.validator';
import { NotFoundError } from '../../shared/errors/app-error';
import { PaginationMeta } from '../../shared/types/api-response.types';

function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
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

export const entityService = {
  /**
   * Listado paginado con búsqueda cross-type (personas, empresas, establecimientos).
   */
  async list(filters: EntityQueryInput) {
    const result = await entityRepository.findAll(filters);
    return {
      data: result.data,
      meta: buildPaginationMeta(result.total, result.page, result.limit),
    };
  },

  /**
   * Detalle completo de una entidad (cualquier tipo) con conteos de relaciones.
   */
  async getById(id: string) {
    const entity = await entityRepository.findById(id);
    if (!entity) {
      throw new NotFoundError('Entidad', id);
    }
    return entity;
  },
};
