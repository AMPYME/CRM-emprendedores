/**
 * Matriz de destinos permitidos al crear una relación (origen → destino).
 *
 * - Persona → persona
 * - Establecimiento → persona | establecimiento
 * - Empresa → empresa | persona | establecimiento
 *
 * Unicidad: un solo vínculo entre el mismo par de entidades (cualquier dirección).
 * Una entidad puede vincularse con varias entidades permitidas, siempre que
 * no se repita el mismo par.
 */
import { EntityType } from '../../shared/types/enums';

export const RELATIONSHIP_TARGETS_BY_SOURCE: Record<EntityType, readonly EntityType[]> = {
  [EntityType.PERSON]: [EntityType.PERSON],
  [EntityType.ESTABLISHMENT]: [EntityType.PERSON, EntityType.ESTABLISHMENT],
  [EntityType.COMPANY]: [EntityType.COMPANY, EntityType.PERSON, EntityType.ESTABLISHMENT],
};

export function isAllowedRelationshipPair(
  fromType: EntityType | string,
  toType: EntityType | string
): boolean {
  const allowed = RELATIONSHIP_TARGETS_BY_SOURCE[fromType as EntityType];
  if (!allowed) return false;
  return allowed.includes(toType as EntityType);
}

export function relationshipPairErrorMessage(
  fromType: EntityType | string,
  toType: EntityType | string
): string {
  const labels: Record<string, string> = {
    PERSON: 'persona',
    COMPANY: 'empresa',
    ESTABLISHMENT: 'establecimiento',
  };
  const fromLabel = labels[fromType] ?? fromType;
  const toLabel = labels[toType] ?? toType;
  return `No se permite relacionar ${fromLabel} → ${toLabel} según las reglas del CRM.`;
}
