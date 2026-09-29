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
import { auditService, AuditActor } from '../audit/audit.service';
import { actorContext, cambios } from '../audit/audit-snapshot';

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
  async create(fromEntityId: string, input: CreateRelationshipInput, actor?: AuditActor) {
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
      const reactivada = await relationshipRepository.update(existingLink.id, {
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
      await auditarRelacion('UPDATE', existingLink, reactivada, actor);
      return reactivada;
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

      const created = await relationshipRepository.create(data);
      await auditarRelacion('CREATE', null, created, actor);
      return created;
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
  async update(id: string, input: UpdateRelationshipInput, actor?: AuditActor) {
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
      const updated = await relationshipRepository.update(id, data);
      await auditarRelacion('UPDATE', current, updated, actor);
      return updated;
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
  async remove(id: string, actor?: AuditActor) {
    const current = await relationshipRepository.findById(id);
    if (!current) {
      throw new NotFoundError('Relación', id);
    }
    const removed = await relationshipRepository.softDelete(id);
    await auditarRelacion('DELETE', current, { ...current, ...removed, isActive: false }, actor);
    return removed;
  },
};

function fechaCorta(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const fecha = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(fecha.getTime())) return null;
  return fecha.toISOString().slice(0, 10);
}

function vistaRelacion(rel: {
  fromEntityId: string;
  toEntityId: string;
  relationshipType: string;
  role?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  isActive: boolean;
  fromEntity?: { displayName?: string | null };
  toEntity?: { displayName?: string | null };
}, entityId: string) {
  const contraparte = rel.fromEntityId === entityId ? rel.toEntity : rel.fromEntity;
  return {
    contraparte: contraparte?.displayName ?? null,
    relationshipType: rel.relationshipType,
    role: rel.role ?? null,
    startDate: fechaCorta(rel.startDate),
    endDate: fechaCorta(rel.endDate),
    isActive: rel.isActive,
  };
}

async function auditarRelacion(
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  before: Parameters<typeof vistaRelacion>[0] | null,
  after: Parameters<typeof vistaRelacion>[0],
  actor?: AuditActor,
) {
  const quien = await actorContext(actor);
  const ids = new Set(
    [before?.fromEntityId, before?.toEntityId, after.fromEntityId, after.toEntityId].filter(
      (id): id is string => Boolean(id),
    ),
  );

  for (const entityId of ids) {
    const previo = before ? vistaRelacion(before, entityId) : null;
    const siguiente = vistaRelacion(after, entityId);
    const diff = previo ? cambios(previo, siguiente) : { anterior: null, nuevo: siguiente };
    const anterior = diff.anterior
      ? { ...diff.anterior, contraparte: previo?.contraparte ?? null }
      : null;
    const nuevo = { ...(diff.nuevo ?? {}), contraparte: siguiente.contraparte };

    await auditService.log({
      action,
      entityType: 'RELATIONSHIP',
      entityId,
      entityLabel: siguiente.contraparte ?? undefined,
      userId: actor?.userId,
      userEmail: actor?.userEmail,
      metadata: { ...quien, anterior, nuevo },
    });
  }
}
