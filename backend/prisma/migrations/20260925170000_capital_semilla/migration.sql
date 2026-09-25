-- Registro histórico de capital semilla. El vínculo con la persona es la cédula normalizada.
CREATE TABLE "capital_semilla" (
    "id" TEXT NOT NULL,
    "external_id" INTEGER,
    "cedula" TEXT NOT NULL,
    "cedula_key" TEXT NOT NULL,
    "province" TEXT,
    "business_name" TEXT,
    "acta_number" TEXT,
    "amount" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capital_semilla_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "capital_semilla_cedula_key_idx" ON "capital_semilla"("cedula_key");
