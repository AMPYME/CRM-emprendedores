ALTER TABLE "portfolio_records" ADD COLUMN "departamento_id" TEXT;

CREATE INDEX "portfolio_records_departamento_id_idx" ON "portfolio_records"("departamento_id");

ALTER TABLE "portfolio_records" ADD CONSTRAINT "portfolio_records_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "portfolio_records" AS pr
SET "departamento_id" = u."departamento_id"
FROM "users" AS u
WHERE pr."assigned_to_id" = u."id"
  AND pr."departamento_id" IS NULL
  AND u."departamento_id" IS NOT NULL;
