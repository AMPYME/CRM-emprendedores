CREATE TABLE "departamentos" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "departamentos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "departamentos_deleted_at_idx" ON "departamentos"("deleted_at");

ALTER TABLE "users" ADD COLUMN "departamento_id" TEXT;
ALTER TABLE "portfolio_actions" ADD COLUMN "sede_id" TEXT;
ALTER TABLE "portfolio_actions" ADD COLUMN "departamento_id" TEXT;

CREATE INDEX "portfolio_actions_sede_id_idx" ON "portfolio_actions"("sede_id");
CREATE INDEX "portfolio_actions_departamento_id_idx" ON "portfolio_actions"("departamento_id");

ALTER TABLE "users" ADD CONSTRAINT "users_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "portfolio_actions" ADD CONSTRAINT "portfolio_actions_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "portfolio_actions" ADD CONSTRAINT "portfolio_actions_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
