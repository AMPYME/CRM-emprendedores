-- CreateEnum
CREATE TYPE "IntakeSessionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VALIDATED', 'EXPIRED');

-- CreateTable
CREATE TABLE "intake_sessions" (
    "id" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL DEFAULT 'PERSON',
    "status" "IntakeSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" VARCHAR(120),
    "access_code_hash" CHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intake_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_entities" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL DEFAULT 'PERSON',
    "display_name" VARCHAR(255),
    "province" VARCHAR(120),
    "district" VARCHAR(120),
    "corregimiento" VARCHAR(120),
    "address" TEXT,
    "notes" TEXT,
    "source_origin" VARCHAR(120) NOT NULL DEFAULT 'EMPRENDEDORES_INTAKE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intake_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_persons" (
    "id" TEXT NOT NULL,
    "intake_entity_id" TEXT NOT NULL,
    "cedula" VARCHAR(40),
    "first_name" VARCHAR(120),
    "last_name" VARCHAR(120),
    "second_last_name" VARCHAR(120),
    "gender" "Gender",
    "birth_date" DATE,
    "nationality_code" CHAR(3) NOT NULL DEFAULT 'PAN',
    "education_level" VARCHAR(120),
    "occupation" VARCHAR(160),
    "business_name" VARCHAR(200),
    "economic_activity" VARCHAR(200),

    CONSTRAINT "intake_persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_companies" (
    "id" TEXT NOT NULL,
    "intake_entity_id" TEXT NOT NULL,
    "ruc" VARCHAR(60),
    "dv" VARCHAR(10),
    "legal_name" VARCHAR(200),
    "trade_name" VARCHAR(200),
    "company_type" VARCHAR(80),
    "economic_activity" VARCHAR(200),
    "founded_date" DATE,
    "employee_count" INTEGER,

    CONSTRAINT "intake_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_establishments" (
    "id" TEXT NOT NULL,
    "intake_entity_id" TEXT NOT NULL,
    "establishment_name" VARCHAR(200),
    "establishment_type" VARCHAR(120),
    "economic_activity" VARCHAR(200),
    "notice_of_operation" VARCHAR(120),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "intake_establishments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_contacts" (
    "id" TEXT NOT NULL,
    "intake_entity_id" TEXT NOT NULL,
    "contact_type" "ContactType" NOT NULL,
    "contact_value" TEXT NOT NULL,
    "label" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "intake_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_relationships" (
    "id" TEXT NOT NULL,
    "from_entity_id" TEXT NOT NULL,
    "to_entity_id" TEXT NOT NULL,
    "relationship_type" "RelationshipType" NOT NULL,
    "role" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intake_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "intake_sessions_status_idx" ON "intake_sessions"("status");

-- CreateIndex
CREATE INDEX "intake_sessions_expires_at_idx" ON "intake_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "intake_sessions_last_activity_at_idx" ON "intake_sessions"("last_activity_at");

-- CreateIndex
CREATE INDEX "intake_sessions_created_by_idx" ON "intake_sessions"("created_by");

-- CreateIndex
CREATE INDEX "intake_entities_session_id_idx" ON "intake_entities"("session_id");

-- CreateIndex
CREATE INDEX "intake_entities_entity_type_idx" ON "intake_entities"("entity_type");

-- CreateIndex
CREATE UNIQUE INDEX "intake_persons_intake_entity_id_key" ON "intake_persons"("intake_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "intake_companies_intake_entity_id_key" ON "intake_companies"("intake_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "intake_establishments_intake_entity_id_key" ON "intake_establishments"("intake_entity_id");

-- CreateIndex
CREATE INDEX "intake_contacts_intake_entity_id_idx" ON "intake_contacts"("intake_entity_id");

-- CreateIndex
CREATE INDEX "intake_relationships_from_entity_id_idx" ON "intake_relationships"("from_entity_id");

-- CreateIndex
CREATE INDEX "intake_relationships_to_entity_id_idx" ON "intake_relationships"("to_entity_id");

-- AddForeignKey
ALTER TABLE "intake_entities" ADD CONSTRAINT "intake_entities_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "intake_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_persons" ADD CONSTRAINT "intake_persons_intake_entity_id_fkey" FOREIGN KEY ("intake_entity_id") REFERENCES "intake_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_companies" ADD CONSTRAINT "intake_companies_intake_entity_id_fkey" FOREIGN KEY ("intake_entity_id") REFERENCES "intake_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_establishments" ADD CONSTRAINT "intake_establishments_intake_entity_id_fkey" FOREIGN KEY ("intake_entity_id") REFERENCES "intake_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_contacts" ADD CONSTRAINT "intake_contacts_intake_entity_id_fkey" FOREIGN KEY ("intake_entity_id") REFERENCES "intake_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_relationships" ADD CONSTRAINT "intake_relationships_from_entity_id_fkey" FOREIGN KEY ("from_entity_id") REFERENCES "intake_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_relationships" ADD CONSTRAINT "intake_relationships_to_entity_id_fkey" FOREIGN KEY ("to_entity_id") REFERENCES "intake_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
