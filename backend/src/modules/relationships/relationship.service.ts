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
import {
  isAllowedRelationshipPair,
  relationshipPairErrorMessage,
} from './relationship.rules';
import { NotFoundError, ConflictError, ValidationError } from '../../shared/errors/app-error';

const DUPLICATE_RELATION_MESSAGE =
  'Ya existe una relación entre estas dos entidades. Edítala o elimínala antes de crear otra.';

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
   * Reglas:
   * - Matriz de tipos origen→destino (ver relationship.rules)
   * - No auto-relación
   * - Un solo vínculo por par de entidades (cualquier dirección)
   * - Misma dirección inactiva → reactivar
   * - Dirección inversa inactiva → reorientar y reactivar
   */
  async create(fromEntityId: string, input: CreateRelationshipInput) {
    if (fromEntityId === input.toEntityId) {
      throw new ConflictError('Una entidad no puede tener una relación consigo misma');
    }

    const [fromType, toType] = await Promise.all([
      relationshipRepository.getEntityType(fromEntityId),
      relationshipRepository.getEntityType(input.toEntityId),
    ]);

    if (!fromType) {
      throw new NotFoundError('Entidad origen', fromEntityId);
    }
    if (!toType) {
      throw new NotFoundError('Entidad destino', input.toEntityId);
    }

    if (!isAllowedRelationshipPair(fromType, toType)) {
      throw new ValidationError(relationshipPairErrorMessage(fromType, toType));
    }

    const existingLink = await relationshipRepository.findLinkBetween(
      fromEntityId,
      input.toEntityId
    );

    if (existingLink) {
      if (existingLink.isActive) {
        throw new ConflictError(DUPLICATE_RELATION_MESSAGE);
      }

      const sameDirection =
        existingLink.fromEntityId === fromEntityId &&
        existingLink.toEntityId === input.toEntityId;

      // Inactiva en cualquier dirección → reactivar con la orientación pedida
      return relationshipRepository.update(existingLink.id, {
        ...(sameDirection
          ? {}
          : {
              fromEntity: { connect: { id: fromEntityId } },
              toEntity: { connect: { id: input.toEntityId } },
            }),
        relationshipType: input.relationshipType as any,
        role: input.role ?? null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        isActive: true,
      });
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
        throw new ConflictError(DUPLICATE_RELATION_MESSAGE);
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

    const nextFromId = current.fromEntityId;
    const nextToId = input.toEntityId ?? current.toEntityId;

    if (nextFromId === nextToId) {
      throw new ConflictError('Una entidad no puede tener una relación consigo misma');
    }

    if (input.toEntityId && input.toEntityId !== current.toEntityId) {
      const [fromType, toType] = await Promise.all([
        relationshipRepository.getEntityType(nextFromId),
        relationshipRepository.getEntityType(nextToId),
      ]);

      if (!toType) {
        throw new NotFoundError('Entidad destino', nextToId);
      }
      if (!fromType) {
        throw new NotFoundError('Entidad origen', nextFromId);
      }
      if (!isAllowedRelationshipPair(fromType, toType)) {
        throw new ValidationError(relationshipPairErrorMessage(fromType, toType));
      }

      const clash = await relationshipRepository.findLinkBetween(nextFromId, nextToId);
      if (clash && clash.id !== current.id) {
        throw new ConflictError(DUPLICATE_RELATION_MESSAGE);
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
        throw new ConflictError(DUPLICATE_RELATION_MESSAGE);
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
