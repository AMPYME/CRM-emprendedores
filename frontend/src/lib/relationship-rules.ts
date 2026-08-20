import type { EntityType } from '@/types/entities.types';

/**
 * Destinos permitidos al crear una relación desde cada tipo de entidad.
 *
 * - Persona → persona | empresa
 * - Empresa → empresa | persona
 */
export const relationshipTargetsBySource: Record<EntityType, EntityType[]> = {
  PERSON: ['PERSON', 'COMPANY'],
  COMPANY: ['COMPANY', 'PERSON'],
};

export const relationshipTargetPlaceholder: Record<EntityType, string> = {
  PERSON: 'Seleccionar persona o empresa...',
  COMPANY: 'Seleccionar empresa o persona...',
};
