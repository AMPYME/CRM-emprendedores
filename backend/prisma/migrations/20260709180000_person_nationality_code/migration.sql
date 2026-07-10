-- Reemplaza nationality (texto libre) por nationality_code (ISO 3166-1 alpha-3).
ALTER TABLE "persons" ADD COLUMN "nationality_code" CHAR(3) NOT NULL DEFAULT 'PAN';

UPDATE "persons"
SET "nationality_code" = 'PAN'
WHERE "nationality_code" IS NULL OR "nationality_code" = '';

ALTER TABLE "persons" DROP COLUMN "nationality";
