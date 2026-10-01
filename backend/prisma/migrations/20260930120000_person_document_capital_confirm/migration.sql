-- Document type / number on persons + capital_semilla.linked_at + person_change_requests

CREATE TYPE "DocumentType" AS ENUM ('CEDULA_NUMERO', 'CEDULA_LETRA', 'PASAPORTE');
CREATE TYPE "PersonChangeAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');
CREATE TYPE "PersonChangeStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

ALTER TABLE "persons"
  ADD COLUMN IF NOT EXISTS "document_type" "DocumentType",
  ADD COLUMN IF NOT EXISTS "document_number" TEXT;

UPDATE "persons"
SET
  "document_number" = "cedula",
  "document_type" = CASE
    WHEN "cedula" ~ '^[0-9]+-[0-9]+-[0-9]+$' THEN 'CEDULA_NUMERO'::"DocumentType"
    WHEN UPPER("cedula") ~ '^(E|PE|N)-[0-9]+-[0-9]+$' THEN 'CEDULA_LETRA'::"DocumentType"
    WHEN UPPER("cedula") ~ '^[A-Z0-9]{1,20}$' AND "cedula" !~ '-' THEN 'PASAPORTE'::"DocumentType"
    ELSE 'CEDULA_NUMERO'::"DocumentType"
  END
WHERE "cedula" IS NOT NULL AND "cedula" <> '' AND "document_number" IS NULL;

CREATE INDEX IF NOT EXISTS "persons_document_number_idx" ON "persons"("document_number");

ALTER TABLE "capital_semilla"
  ADD COLUMN IF NOT EXISTS "linked_at" DATE;

CREATE INDEX IF NOT EXISTS "capital_semilla_linked_at_idx" ON "capital_semilla"("linked_at");

CREATE TABLE IF NOT EXISTS "person_change_requests" (
  "id" TEXT NOT NULL,
  "action" "PersonChangeAction" NOT NULL,
  "status" "PersonChangeStatus" NOT NULL DEFAULT 'PENDING',
  "entity_id" TEXT,
  "person_id" TEXT,
  "payload" JSONB,
  "summary" TEXT,
  "requested_by_id" TEXT NOT NULL,
  "confirmed_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "person_change_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "person_change_requests_requested_by_id_status_idx"
  ON "person_change_requests"("requested_by_id", "status");
CREATE INDEX IF NOT EXISTS "person_change_requests_status_idx"
  ON "person_change_requests"("status");
CREATE INDEX IF NOT EXISTS "person_change_requests_entity_id_idx"
  ON "person_change_requests"("entity_id");

ALTER TABLE "person_change_requests"
  DROP CONSTRAINT IF EXISTS "person_change_requests_requested_by_id_fkey";
ALTER TABLE "person_change_requests"
  ADD CONSTRAINT "person_change_requests_requested_by_id_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
