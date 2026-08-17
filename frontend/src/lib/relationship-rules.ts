import type { EntityType } from '@/types/entities.types';

/**
 * Destinos permitidos al crear una relación desde cada tipo de entidad.
 *
 * - Persona → persona
 * - Establecimiento → persona | establecimiento
 * - Empresa → empresa | persona | establecimiento
 */
export const relationshipTargetsBySource: Record<EntityType, EntityType[]> = {
  PERSON: ['PERSON'],
  ESTABLISHMENT: ['PERSON', 'ESTABLISHMENT'],
  COMPANY: ['COMPANY', 'PERSON', 'ESTABLISHMENT'],
};

export const relationshipTargetPlaceholder: Record<EntityType, string> = {
  PERSON: 'Seleccionar persona...',
  ESTABLISHMENT: 'Seleccionar persona o establecimiento...',
  COMPANY: 'Seleccionar empresa, persona o establecimiento...',
};
