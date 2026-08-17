-- Una sola relación por par de entidades (from → to), sin importar el tipo.
-- Antes: UNIQUE(from, to, relationship_type) permitía duplicar la misma ficha
-- con tipos distintos (ej. OWNER y BRANCH hacia la misma cooperativa).

-- Conservar la fila más reciente/activa por (from_entity_id, to_entity_id);
-- eliminar el resto (requerido para poder crear el UNIQUE).
DELETE FROM entity_relationships
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY from_entity_id, to_entity_id
        ORDER BY is_active DESC, updated_at DESC, created_at DESC
      ) AS rn
    FROM entity_relationships
  ) ranked
  WHERE rn > 1
);

DROP INDEX IF EXISTS "entity_relationships_from_entity_id_to_entity_id_relationsh_key";

CREATE UNIQUE INDEX IF NOT EXISTS "entity_relationships_from_entity_id_to_entity_id_key"
  ON "entity_relationships"("from_entity_id", "to_entity_id");
