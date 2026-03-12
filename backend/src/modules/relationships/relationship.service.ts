/**
 * Service del módulo de relaciones entre entidades.
 * Lógica de negocio para vincular personas, empresas y establecimientos.
 */
import { Prisma } from '@prisma/client';
import { relationshipRepository } from './relationship.repository';
import {
  CreateRelationshipInput,
  UpdateRelationshipInput,
  RelationshipQueryInput,
} from './relationship.validator';
import { NotFoundError, ConflictError } from '../../shared/errors/app-error';

export const relationshipService = {
  /**
   * Lista relaciones asociadas a una entidad (origen, destino o ambas).
   */
  async listByEntity(entityId: string, input: RelationshipQueryInput) {
    const exists = await relationshipRepository.entityExists(entityId);
    if (!exists) {
      throw new NotFoundError('Entidad', entityId);
    }
    return relationshipRepository.findByEntity(entityId, input);
  },

  /**
   * Crea una nueva relación desde una entidad hacia otra.
   */
  async create(fromEntityId: string, input: CreateRelationshipInput) {
    if (fromEntityId === input.toEntityId) {
      throw new ConflictError('Una entidad no puede tener una relación consigo misma');
    }

    const [fromExists, toExists] = await Promise.all([
      relationshipRepository.entityExists(fromEntityId),
      relationshipRepository.entityExists(input.toEntityId),
    ]);

    if (!fromExists) {
      throw new NotFoundError('Entidad origen', fromEntityId);
    }
    if (!toExists) {
      throw new NotFoundError('Entidad destino', input.toEntityId);
    }

    try {
      const data: Prisma.EntityRelationshipCreateInput = {
        fromEntity: { connect: { id: fromEntityId } },
        toEntity: { connect: { id: input.toEntityId } },
        relationshipType: input.relationshipType as any,
        role: input.role,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        isActive: input.isActive ?? true,
      };

      return await relationshipRepository.create(data);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        // Unique constraint violation (fromEntityId, toEntityId, relationshipType)
        throw new ConflictError('Ya existe una relación de este tipo entre las dos entidades');
      }
      throw err;
    }
  },

  /**
   * Actualiza una relación existente.
   */
  async update(id: string, input: UpdateRelationshipInput) {
    const current = await relationshipRepository.findById(id);
    if (!current) {
      throw new NotFoundError('Relación', id);
    }

    // Si cambia entidad destino, validar existencia
    if (input.toEntityId && input.toEntityId !== current.toEntityId) {
      const toExists = await relationshipRepository.entityExists(input.toEntityId);
      if (!toExists) {
        throw new NotFoundError('Entidad destino', input.toEntityId);
      }
    }

    const data: Prisma.EntityRelationshipUpdateInput = {};

    if (input.toEntityId !== undefined) {
      data.toEntity = { connect: { id: input.toEntityId } };
    }
    if (input.relationshipType !== undefined) {
      data.relationshipType = input.relationshipType as any;
    }
    if (input.role !== undefined) {
      data.role = input.role;
    }
    if (input.startDate !== undefined) {
      data.startDate = input.startDate ? new Date(input.startDate) : null;
    }
    if (input.endDate !== undefined) {
      data.endDate = input.endDate ? new Date(input.endDate) : null;
    }
    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }

    try {
      return await relationshipRepository.update(id, data);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictError('Ya existe una relación de este tipo entre las dos entidades');
      }
      throw err;
    }
  },

  /**
   * Soft delete: marca la relación como inactiva.
   */
  async remove(id: string) {
    const current = await relationshipRepository.findById(id);
    if (!current) {
      throw new NotFoundError('Relación', id);
    }
    return relationshipRepository.softDelete(id);
  },
};

