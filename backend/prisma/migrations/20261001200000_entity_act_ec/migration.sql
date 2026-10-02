-- AlterTable
ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "act_ec" VARCHAR(128);

-- Backfill from person/company economic_activity when available
UPDATE "entities" e
SET "act_ec" = LEFT(p."economic_activity", 128)
FROM "persons" p
WHERE p."entity_id" = e."id"
  AND e."act_ec" IS NULL
  AND p."economic_activity" IS NOT NULL
  AND LENGTH(TRIM(p."economic_activity")) > 0;

UPDATE "entities" e
SET "act_ec" = LEFT(c."economic_activity", 128)
FROM "companies" c
WHERE c."entity_id" = e."id"
  AND e."act_ec" IS NULL
  AND c."economic_activity" IS NOT NULL
  AND LENGTH(TRIM(c."economic_activity")) > 0;
