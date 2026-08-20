-- Sincroniza UserRole al modelo CRM actual.
-- Seguro si el baseline ya creó los valores nuevos (no-op).
-- Convierte roles legacy: OPERATOR/MANAGER/ANALYST → EMPREND_OPERADOR, VIEWER → EMPREND_VIEWER.

DO $$
DECLARE
  has_legacy boolean;
  has_new boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole'
      AND e.enumlabel IN ('OPERATOR', 'VIEWER', 'MANAGER', 'ANALYST')
  ) INTO has_legacy;

  SELECT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole'
      AND e.enumlabel = 'EMPREND_OPERADOR'
  ) INTO has_new;

  IF NOT has_legacy AND has_new THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM (
      'SUPER_ADMIN',
      'ADMIN',
      'EMPREND_ADMIN',
      'EMPREND_OPERADOR',
      'EMPREND_VIEWER'
    );
    RETURN;
  END IF;

  CREATE TYPE "UserRole_new" AS ENUM (
    'SUPER_ADMIN',
    'ADMIN',
    'EMPREND_ADMIN',
    'EMPREND_OPERADOR',
    'EMPREND_VIEWER'
  );

  ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

  ALTER TABLE "users"
    ALTER COLUMN "role" TYPE TEXT
    USING (
      CASE "role"::text
        WHEN 'OPERATOR' THEN 'EMPREND_OPERADOR'
        WHEN 'MANAGER' THEN 'EMPREND_OPERADOR'
        WHEN 'ANALYST' THEN 'EMPREND_OPERADOR'
        WHEN 'VIEWER' THEN 'EMPREND_VIEWER'
        WHEN 'EMPREND_ADMIN' THEN 'EMPREND_ADMIN'
        WHEN 'EMPREND_OPERADOR' THEN 'EMPREND_OPERADOR'
        WHEN 'EMPREND_VIEWER' THEN 'EMPREND_VIEWER'
        WHEN 'SUPER_ADMIN' THEN 'SUPER_ADMIN'
        WHEN 'ADMIN' THEN 'ADMIN'
        ELSE 'EMPREND_OPERADOR'
      END
    );

  ALTER TABLE "users"
    ALTER COLUMN "role" TYPE "UserRole_new"
    USING ("role"::"UserRole_new");

  DROP TYPE "UserRole";
  ALTER TYPE "UserRole_new" RENAME TO "UserRole";

  ALTER TABLE "users"
    ALTER COLUMN "role" SET DEFAULT 'EMPREND_OPERADOR'::"UserRole";
END $$;
