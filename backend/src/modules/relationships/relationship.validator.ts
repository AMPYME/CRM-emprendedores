/**
 * Validadores Zod para el módulo de relaciones entre entidades.
 */
import { z } from 'zod';
import { RelationshipType, EntityType } from '../../shared/types/enums';

// ── Helpers ─────────────────────────────────────────────────────────

const relationshipTypeValues = Object.values(RelationshipType) as [string, ...string[]];
const entityTypeValues = Object.values(EntityType) as [string, ...string[]];

// ── Params ──────────────────────────────────────────────────────────

export const entityIdParamSchema = z.object({
  entityId: z.string().uuid('Entity ID debe ser un UUID válido'),
});

export const relationshipIdParamSchema = z.object({
  id: z.string().uuid('Relationship ID debe ser un UUID válido'),
});

// ── Crear relación ─────────────────────────────────────────────────

export const createRelationshipSchema = z.object({
  toEntityId: z.string().uuid('ID de entidad destino debe ser un UUID válido'),
  relationshipType: z.enum(relationshipTypeValues as [string, ...string[]]),
  role: z.string().max(100).trim().optional(),
  startDate: z
    .string()
    .datetime('Fecha de inicio debe ser una fecha ISO válida')
    .optional(),
  endDate: z
    .string()
    .datetime('Fecha de fin debe ser una fecha ISO válida')
    .optional(),
  isActive: z.boolean().optional(),
});

export type CreateRelationshipInput = z.infer<typeof createRelationshipSchema>;

// ── Actualizar relación ─────────────────────────────────────────────

export const updateRelationshipSchema = createRelationshipSchema
  .partial()
  .extend({
    // Permitimos opcionalmente cambiar toEntityId en una actualización
    toEntityId: z.string().uuid('ID de entidad destino debe ser un UUID válido').optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export type UpdateRelationshipInput = z.infer<typeof updateRelationshipSchema>;

// ── Query de listado por entidad ────────────────────────────────────

export const relationshipQuerySchema = z.object({
  direction: z.enum(['from', 'to', 'both']).default('from').optional(),
  relationshipType: z.enum(relationshipTypeValues as [string, ...string[]]).optional(),
  targetEntityType: z.enum(entityTypeValues as [string, ...string[]]).optional(),
  isActive: z
    .string()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined))
    .optional()
    .or(z.boolean().optional()),
});

export type RelationshipQueryInput = {
  direction?: 'from' | 'to' | 'both';
  relationshipType?: RelationshipType;
  targetEntityType?: EntityType;
  isActive?: boolean;
};

