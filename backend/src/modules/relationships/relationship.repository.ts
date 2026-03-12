/**
 * Repository del módulo de relaciones entre entidades.
 * Queries Prisma para CRUD de EntityRelationship.
 */
import { Prisma, EntityRelationship } from '@prisma/client';
import { prisma } from '../../config/database';
import { ENTITY_LIST_INCLUDES } from '../../shared/types/entity.types';
import { RelationshipQueryInput } from './relationship.validator';

export const relationshipRepository = {
  /**
   * Verifica si una entidad existe.
   */
  async entityExists(entityId: string): Promise<boolean> {
    const entity = await prisma.entity.findUnique({
      where: { id: entityId },
      select: { id: true },
    });
    return !!entity;
  },

  /**
   * Busca una relación por ID, incluyendo entidades origen/destino.
   */
  async findById(id: string): Promise<EntityRelationship & { fromEntity: any; toEntity: any } | null> {
    return prisma.entityRelationship.findUnique({
      where: { id },
      include: {
        fromEntity: { include: ENTITY_LIST_INCLUDES },
        toEntity: { include: ENTITY_LIST_INCLUDES },
      },
    }) as any;
  },

  /**
   * Lista relaciones de una entidad, con filtros.
   */
  async findByEntity(
    entityId: string,
    input: RelationshipQueryInput
  ): Promise<Array<EntityRelationship & { fromEntity: any; toEntity: any }>> {
    const direction = input.direction ?? 'from';

    const where: Prisma.EntityRelationshipWhereInput = {};

    if (direction === 'from') {
      where.fromEntityId = entityId;
    } else if (direction === 'to') {
      where.toEntityId = entityId;
    } else {
      where.OR = [{ fromEntityId: entityId }, { toEntityId: entityId }];
    }

    if (input.relationshipType) {
      where.relationshipType = input.relationshipType as any;
    }

    if (typeof input.isActive === 'boolean') {
      where.isActive = input.isActive;
    }

    if (input.targetEntityType && direction !== 'both') {
      if (direction === 'from') {
        where.toEntity = { entityType: input.targetEntityType as any };
      } else if (direction === 'to') {
        where.fromEntity = { entityType: input.targetEntityType as any };
      }
    }

    return prisma.entityRelationship.findMany({
      where,
      include: {
        fromEntity: { include: ENTITY_LIST_INCLUDES },
        toEntity: { include: ENTITY_LIST_INCLUDES },
      },
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'desc' },
      ],
    }) as any;
  },

  /**
   * Crea una nueva relación.
   */
  async create(data: Prisma.EntityRelationshipCreateInput) {
    return prisma.entityRelationship.create({
      data,
      include: {
        fromEntity: { include: ENTITY_LIST_INCLUDES },
        toEntity: { include: ENTITY_LIST_INCLUDES },
      },
    }) as any;
  },

  /**
   * Actualiza una relación existente.
   */
  async update(id: string, data: Prisma.EntityRelationshipUpdateInput) {
    return prisma.entityRelationship.update({
      where: { id },
      data,
      include: {
        fromEntity: { include: ENTITY_LIST_INCLUDES },
        toEntity: { include: ENTITY_LIST_INCLUDES },
      },
    }) as any;
  },

  /**
   * Soft delete: marca la relación como inactiva y, opcionalmente, pone endDate.
   */
  async softDelete(id: string): Promise<EntityRelationship> {
    return prisma.entityRelationship.update({
      where: { id },
      data: {
        isActive: false,
        endDate: new Date(),
      },
    });
  },
};

