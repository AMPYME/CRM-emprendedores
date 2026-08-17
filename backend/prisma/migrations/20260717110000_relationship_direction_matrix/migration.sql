-- Alinea relaciones existentes con la matriz de dirección:
-- PERSON -> PERSON
-- ESTABLISHMENT -> PERSON | ESTABLISHMENT
-- COMPANY -> PERSON | ESTABLISHMENT | COMPANY
--
-- Además garantiza en PostgreSQL un solo vínculo lógico por par,
-- independientemente de la dirección (A->B o B->A).

-- 1. Conservar una sola fila por par no ordenado antes de reorientar.
DELETE FROM "entity_relationships"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY
          LEAST("from_entity_id", "to_entity_id"),
          GREATEST("from_entity_id", "to_entity_id")
        ORDER BY "is_active" DESC, "updated_at" DESC, "created_at" DESC
      ) AS "rn"
    FROM "entity_relationships"
  ) AS "ranked"
  WHERE "rn" > 1
);

-- 2. Reorientar los pares que ya no están permitidos.
-- PERSON -> COMPANY       pasa a COMPANY -> PERSON
-- PERSON -> ESTABLISHMENT pasa a ESTABLISHMENT -> PERSON
-- ESTABLISHMENT -> COMPANY pasa a COMPANY -> ESTABLISHMENT
WITH "invalid_relationships" AS (
  SELECT
    "r"."id",
    "r"."from_entity_id" AS "old_from_entity_id",
    "r"."to_entity_id" AS "old_to_entity_id"
  FROM "entity_relationships" AS "r"
  JOIN "entities" AS "from_entity" ON "from_entity"."id" = "r"."from_entity_id"
  JOIN "entities" AS "to_entity" ON "to_entity"."id" = "r"."to_entity_id"
  WHERE
    ("from_entity"."entity_type" = 'PERSON' AND "to_entity"."entity_type" IN ('COMPANY', 'ESTABLISHMENT'))
    OR
    ("from_entity"."entity_type" = 'ESTABLISHMENT' AND "to_entity"."entity_type" = 'COMPANY')
)
UPDATE "entity_relationships" AS "r"
SET
  "from_entity_id" = "invalid_relationships"."old_to_entity_id",
  "to_entity_id" = "invalid_relationships"."old_from_entity_id",
  "updated_at" = CURRENT_TIMESTAMP
FROM "invalid_relationships"
WHERE "r"."id" = "invalid_relationships"."id";

-- 3. La restricción Prisma cubre el par dirigido; este índice adicional
-- cierra la carrera concurrente entre A->B y B->A.
CREATE UNIQUE INDEX IF NOT EXISTS "entity_relationships_unordered_pair_key"
  ON "entity_relationships" (
    LEAST("from_entity_id", "to_entity_id"),
    GREATEST("from_entity_id", "to_entity_id")
  );
