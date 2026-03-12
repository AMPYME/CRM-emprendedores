-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PERSON', 'COMPANY', 'ESTABLISHMENT');

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DUPLICATE', 'MERGED');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('EMAIL', 'PHONE', 'MOBILE', 'WHATSAPP', 'WEBSITE', 'SOCIAL_MEDIA', 'OTHER');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('OWNER', 'EMPLOYEE', 'PARTNER', 'BRANCH', 'REPRESENTATIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('REGISTERED', 'CONFIRMED', 'ATTENDED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PortfolioStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PortfolioPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('CALL', 'EMAIL_ACTION', 'VISIT', 'MEETING', 'WHATSAPP', 'NOTE', 'DOCUMENT', 'STATUS_CHANGE', 'OTHER');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'VALIDATING', 'DEDUPLICATING', 'REVIEW_REQUIRED', 'IMPORTING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StagingRowStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'DUPLICATE_EXACT', 'DUPLICATE_POSSIBLE', 'IMPORTED', 'SKIPPED', 'ERROR');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'ANALYST', 'OPERATOR', 'VIEWER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "display_name" TEXT NOT NULL,
    "province" TEXT,
    "district" TEXT,
    "corregimiento" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "source_origin" TEXT,
    "import_batch_id" TEXT,
    "merged_into_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persons" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "cedula" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "second_last_name" TEXT,
    "gender" "Gender",
    "birth_date" TIMESTAMP(3),
    "nationality" TEXT,
    "education_level" TEXT,
    "occupation" TEXT,
    "business_name" TEXT,
    "economic_activity" TEXT,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "ruc" TEXT,
    "dv" TEXT,
    "legal_name" TEXT NOT NULL,
    "trade_name" TEXT,
    "company_type" TEXT,
    "economic_activity" TEXT,
    "founded_date" TIMESTAMP(3),
    "employee_count" INTEGER,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "establishments" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "establishment_name" TEXT NOT NULL,
    "establishment_type" TEXT,
    "economic_activity" TEXT,
    "notice_of_operation" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "establishments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_contacts" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "contact_type" "ContactType" NOT NULL,
    "contact_value" TEXT NOT NULL,
    "label" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_relationships" (
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

    CONSTRAINT "entity_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "event_type" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "location" TEXT,
    "province" TEXT,
    "max_capacity" INTEGER,
    "form_fields" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registrations" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "attended_at" TIMESTAMP(3),
    "notes" TEXT,
    "source_origin" TEXT,
    "import_batch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registration_answers" (
    "id" TEXT NOT NULL,
    "registration_id" TEXT NOT NULL,
    "field_key" TEXT NOT NULL,
    "field_label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_registration_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_records" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "status" "PortfolioStatus" NOT NULL DEFAULT 'NEW',
    "priority" "PortfolioPriority" NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "next_follow_up_date" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "closed_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_actions" (
    "id" TEXT NOT NULL,
    "portfolio_id" TEXT NOT NULL,
    "performed_by_id" TEXT,
    "action_type" "ActionType" NOT NULL,
    "description" TEXT NOT NULL,
    "result" TEXT,
    "next_steps" TEXT,
    "action_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "target_event_id" TEXT,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "invalid_rows" INTEGER NOT NULL DEFAULT 0,
    "duplicate_rows" INTEGER NOT NULL DEFAULT 0,
    "imported_rows" INTEGER NOT NULL DEFAULT 0,
    "skipped_rows" INTEGER NOT NULL DEFAULT 0,
    "error_log" JSONB,
    "column_mapping" JSONB,
    "imported_by_id" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staging_rows" (
    "id" TEXT NOT NULL,
    "import_batch_id" TEXT NOT NULL,
    "row_number" INTEGER NOT NULL,
    "status" "StagingRowStatus" NOT NULL DEFAULT 'PENDING',
    "raw_data" JSONB NOT NULL,
    "extracted_cedula" TEXT,
    "extracted_ruc" TEXT,
    "extracted_first_name" TEXT,
    "extracted_last_name" TEXT,
    "extracted_email" TEXT,
    "extracted_phone" TEXT,
    "extracted_business_name" TEXT,
    "validation_errors" JSONB,
    "matched_entity_id" TEXT,
    "match_score" DOUBLE PRECISION,
    "match_reason" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staging_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "entities_entity_type_idx" ON "entities"("entity_type");

-- CreateIndex
CREATE INDEX "entities_status_idx" ON "entities"("status");

-- CreateIndex
CREATE INDEX "entities_display_name_idx" ON "entities"("display_name");

-- CreateIndex
CREATE INDEX "entities_province_idx" ON "entities"("province");

-- CreateIndex
CREATE INDEX "entities_source_origin_idx" ON "entities"("source_origin");

-- CreateIndex
CREATE INDEX "entities_import_batch_id_idx" ON "entities"("import_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "persons_entity_id_key" ON "persons"("entity_id");

-- CreateIndex
CREATE INDEX "persons_cedula_idx" ON "persons"("cedula");

-- CreateIndex
CREATE INDEX "persons_first_name_last_name_idx" ON "persons"("first_name", "last_name");

-- CreateIndex
CREATE INDEX "persons_last_name_idx" ON "persons"("last_name");

-- CreateIndex
CREATE UNIQUE INDEX "companies_entity_id_key" ON "companies"("entity_id");

-- CreateIndex
CREATE INDEX "companies_ruc_idx" ON "companies"("ruc");

-- CreateIndex
CREATE INDEX "companies_legal_name_idx" ON "companies"("legal_name");

-- CreateIndex
CREATE INDEX "companies_trade_name_idx" ON "companies"("trade_name");

-- CreateIndex
CREATE UNIQUE INDEX "establishments_entity_id_key" ON "establishments"("entity_id");

-- CreateIndex
CREATE INDEX "establishments_establishment_name_idx" ON "establishments"("establishment_name");

-- CreateIndex
CREATE INDEX "establishments_economic_activity_idx" ON "establishments"("economic_activity");

-- CreateIndex
CREATE INDEX "entity_contacts_entity_id_idx" ON "entity_contacts"("entity_id");

-- CreateIndex
CREATE INDEX "entity_contacts_contact_type_contact_value_idx" ON "entity_contacts"("contact_type", "contact_value");

-- CreateIndex
CREATE INDEX "entity_contacts_contact_value_idx" ON "entity_contacts"("contact_value");

-- CreateIndex
CREATE INDEX "entity_relationships_from_entity_id_idx" ON "entity_relationships"("from_entity_id");

-- CreateIndex
CREATE INDEX "entity_relationships_to_entity_id_idx" ON "entity_relationships"("to_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "entity_relationships_from_entity_id_to_entity_id_relationsh_key" ON "entity_relationships"("from_entity_id", "to_entity_id", "relationship_type");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_status_idx" ON "events"("status");

-- CreateIndex
CREATE INDEX "events_start_date_idx" ON "events"("start_date");

-- CreateIndex
CREATE INDEX "event_registrations_event_id_idx" ON "event_registrations"("event_id");

-- CreateIndex
CREATE INDEX "event_registrations_entity_id_idx" ON "event_registrations"("entity_id");

-- CreateIndex
CREATE INDEX "event_registrations_status_idx" ON "event_registrations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_event_id_entity_id_key" ON "event_registrations"("event_id", "entity_id");

-- CreateIndex
CREATE INDEX "event_registration_answers_registration_id_idx" ON "event_registration_answers"("registration_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_registration_answers_registration_id_field_key_key" ON "event_registration_answers"("registration_id", "field_key");

-- CreateIndex
CREATE INDEX "portfolio_records_entity_id_idx" ON "portfolio_records"("entity_id");

-- CreateIndex
CREATE INDEX "portfolio_records_assigned_to_id_idx" ON "portfolio_records"("assigned_to_id");

-- CreateIndex
CREATE INDEX "portfolio_records_status_idx" ON "portfolio_records"("status");

-- CreateIndex
CREATE INDEX "portfolio_records_priority_idx" ON "portfolio_records"("priority");

-- CreateIndex
CREATE INDEX "portfolio_records_next_follow_up_date_idx" ON "portfolio_records"("next_follow_up_date");

-- CreateIndex
CREATE INDEX "portfolio_actions_portfolio_id_idx" ON "portfolio_actions"("portfolio_id");

-- CreateIndex
CREATE INDEX "portfolio_actions_performed_by_id_idx" ON "portfolio_actions"("performed_by_id");

-- CreateIndex
CREATE INDEX "portfolio_actions_action_date_idx" ON "portfolio_actions"("action_date");

-- CreateIndex
CREATE INDEX "import_batches_status_idx" ON "import_batches"("status");

-- CreateIndex
CREATE INDEX "import_batches_source_type_idx" ON "import_batches"("source_type");

-- CreateIndex
CREATE INDEX "import_batches_imported_by_id_idx" ON "import_batches"("imported_by_id");

-- CreateIndex
CREATE INDEX "staging_rows_import_batch_id_idx" ON "staging_rows"("import_batch_id");

-- CreateIndex
CREATE INDEX "staging_rows_status_idx" ON "staging_rows"("status");

-- CreateIndex
CREATE INDEX "staging_rows_extracted_cedula_idx" ON "staging_rows"("extracted_cedula");

-- CreateIndex
CREATE INDEX "staging_rows_extracted_ruc_idx" ON "staging_rows"("extracted_ruc");

-- CreateIndex
CREATE INDEX "staging_rows_extracted_email_idx" ON "staging_rows"("extracted_email");

-- CreateIndex
CREATE INDEX "staging_rows_extracted_phone_idx" ON "staging_rows"("extracted_phone");

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "establishments" ADD CONSTRAINT "establishments_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_contacts" ADD CONSTRAINT "entity_contacts_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_from_entity_id_fkey" FOREIGN KEY ("from_entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_to_entity_id_fkey" FOREIGN KEY ("to_entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registration_answers" ADD CONSTRAINT "event_registration_answers_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "event_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_records" ADD CONSTRAINT "portfolio_records_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_records" ADD CONSTRAINT "portfolio_records_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_actions" ADD CONSTRAINT "portfolio_actions_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolio_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_actions" ADD CONSTRAINT "portfolio_actions_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_imported_by_id_fkey" FOREIGN KEY ("imported_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staging_rows" ADD CONSTRAINT "staging_rows_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staging_rows" ADD CONSTRAINT "staging_rows_matched_entity_id_fkey" FOREIGN KEY ("matched_entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
