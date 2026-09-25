-- Capital semilla en personas y en el borrador de intake.
ALTER TABLE "persons" ADD COLUMN "seed_capital" INTEGER;
ALTER TABLE "persons" ADD COLUMN "seed_capital_date" VARCHAR(7);

ALTER TABLE "intake_persons" ADD COLUMN "seed_capital" INTEGER;
ALTER TABLE "intake_persons" ADD COLUMN "seed_capital_date" VARCHAR(7);

-- Sedes normalizadas y asignación a usuarios y seguimientos.
CREATE TABLE "sedes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sedes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sedes_deleted_at_idx" ON "sedes"("deleted_at");

ALTER TABLE "users" ADD COLUMN "sede_id" TEXT;
ALTER TABLE "portfolio_records" ADD COLUMN "sede_id" TEXT;

CREATE INDEX "portfolio_records_sede_id_idx" ON "portfolio_records"("sede_id");

ALTER TABLE "users" ADD CONSTRAINT "users_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "portfolio_records" ADD CONSTRAINT "portfolio_records_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
