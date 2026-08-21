-- Columnas que el baseline declara en CREATE TABLE, pero que no existen si
-- esa migración se marcó como aplicada sobre una BD anterior (persons vieja).
-- Solo altera tablas que ya existen (IF NOT EXISTS en columnas).

DO $$
BEGIN
  IF to_regclass('public.persons') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "persons" ADD COLUMN IF NOT EXISTS "second_last_name" TEXT';
    EXECUTE 'ALTER TABLE "persons" ADD COLUMN IF NOT EXISTS "birth_date" TIMESTAMP(3)';
    EXECUTE 'ALTER TABLE "persons" ADD COLUMN IF NOT EXISTS "nationality_code" CHAR(3) DEFAULT ''PAN''';
    EXECUTE 'ALTER TABLE "persons" ADD COLUMN IF NOT EXISTS "education_level" TEXT';
    EXECUTE 'ALTER TABLE "persons" ADD COLUMN IF NOT EXISTS "occupation" TEXT';
    EXECUTE 'ALTER TABLE "persons" ADD COLUMN IF NOT EXISTS "business_name" TEXT';
    EXECUTE 'ALTER TABLE "persons" ADD COLUMN IF NOT EXISTS "economic_activity" TEXT';
    EXECUTE 'ALTER TABLE "persons" ADD COLUMN IF NOT EXISTS "has_artisan_card" BOOLEAN';
  END IF;

  IF to_regclass('public.intake_persons') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "intake_persons" ADD COLUMN IF NOT EXISTS "second_last_name" VARCHAR(120)';
    EXECUTE 'ALTER TABLE "intake_persons" ADD COLUMN IF NOT EXISTS "education_level" VARCHAR(120)';
    EXECUTE 'ALTER TABLE "intake_persons" ADD COLUMN IF NOT EXISTS "occupation" VARCHAR(160)';
    EXECUTE 'ALTER TABLE "intake_persons" ADD COLUMN IF NOT EXISTS "business_name" VARCHAR(200)';
    EXECUTE 'ALTER TABLE "intake_persons" ADD COLUMN IF NOT EXISTS "economic_activity" VARCHAR(200)';
    EXECUTE 'ALTER TABLE "intake_persons" ADD COLUMN IF NOT EXISTS "has_artisan_card" BOOLEAN';
  END IF;
END $$;
