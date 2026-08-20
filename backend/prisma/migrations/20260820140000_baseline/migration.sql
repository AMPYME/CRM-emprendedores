-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PERSON', 'COMPANY');

-- CreateEnum
CREATE TYPE "CompanySizeClass" AS ENUM ('MICRO', 'PEQUENA', 'MEDIANA');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'VERIFICATION_CLAIM', 'VERIFICATION_UPDATE', 'VERIFICATION_VALIDATE', 'VERIFICATION_REJECT');

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DUPLICATE', 'MERGED');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('EMAIL', 'PHONE', 'MOBILE', 'WHATSAPP', 'WEBSITE', 'SOCIAL_MEDIA', 'OTHER');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('OWNER', 'EMPLOYEE', 'PARTNER', 'BRANCH', 'REPRESENTATIVE', 'RELATED', 'SUBSIDIARY', 'AFFILIATED', 'OTHER');

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
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'VALIDATING', 'DEDUPLICATING', 'REVIEW_REQUIRED', 'IMPORTING', 'VERIFICATION_QUEUED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StagingRowStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'DUPLICATE_EXACT', 'DUPLICATE_POSSIBLE', 'IMPORTED', 'QUEUED_FOR_VERIFICATION', 'SKIPPED', 'ERROR');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'EMPREND_ADMIN', 'EMPREND_OPERADOR', 'EMPREND_VIEWER');

-- CreateEnum
CREATE TYPE "IntakeSessionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VALIDATED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VerificationSource" AS ENUM ('IMPORT', 'FIELD');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_REVIEW', 'VALIDATED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'EMPREND_OPERADOR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "entity_label" TEXT,
    "user_id" TEXT,
    "user_email" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "display_name" TEXT NOT NULL,
    "cod_prov" CHAR(2),
    "cod_dist" CHAR(4),
    "cod_corr" CHAR(6),
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
    "nationality_code" CHAR(3) NOT NULL DEFAULT 'PAN',
    "education_level" TEXT,
    "occupation" TEXT,
    "business_name" TEXT,
    "economic_activity" TEXT,
    "has_artisan_card" BOOLEAN,

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
    "company_size_class" "CompanySizeClass",
    "economic_activity" TEXT,
    "founded_date" TIMESTAMP(3),
    "employee_count" INTEGER,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "provincias" (
    "codProv" CHAR(2) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,

    CONSTRAINT "provincias_pkey" PRIMARY KEY ("codProv")
);

-- CreateTable
CREATE TABLE "distritos" (
    "codDist" CHAR(4) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "codProv" CHAR(2) NOT NULL,

    CONSTRAINT "distritos_pkey" PRIMARY KEY ("codDist")
);

-- CreateTable
CREATE TABLE "corregimientos" (
    "codCorr" CHAR(6) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "codDist" CHAR(4) NOT NULL,

    CONSTRAINT "corregimientos_pkey" PRIMARY KEY ("codCorr")
);

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
    "has_artisan_card" BOOLEAN,

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
    "company_size_class" "CompanySizeClass",
    "economic_activity" VARCHAR(200),
    "founded_date" DATE,
    "employee_count" INTEGER,

    CONSTRAINT "intake_companies_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "verification_items" (
    "id" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "source" "VerificationSource" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "import_batch_id" TEXT,
    "staging_row_id" TEXT,
    "assigned_to_id" TEXT,
    "assigned_at" TIMESTAMP(3),
    "intake_session_id" TEXT,
    "data" JSONB NOT NULL,
    "cod_prov" CHAR(2),
    "cod_dist" CHAR(4),
    "cod_corr" CHAR(6),
    "display_name" VARCHAR(255),
    "search_cedula" VARCHAR(40),
    "search_ruc" VARCHAR(60),
    "search_text" VARCHAR(500),
    "validated_entity_id" TEXT,
    "validated_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs"("entity_type");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "entities_entity_type_idx" ON "entities"("entity_type");

-- CreateIndex
CREATE INDEX "entities_status_idx" ON "entities"("status");

-- CreateIndex
CREATE INDEX "entities_display_name_idx" ON "entities"("display_name");

-- CreateIndex
CREATE INDEX "entities_cod_prov_idx" ON "entities"("cod_prov");

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
CREATE INDEX "entity_relationships_relationship_type_idx" ON "entity_relationships"("relationship_type");

-- CreateIndex
CREATE UNIQUE INDEX "entity_relationships_from_entity_id_to_entity_id_key" ON "entity_relationships"("from_entity_id", "to_entity_id");

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

-- CreateIndex
CREATE INDEX "distritos_codProv_idx" ON "distritos"("codProv");

-- CreateIndex
CREATE INDEX "corregimientos_codDist_idx" ON "corregimientos"("codDist");

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
CREATE INDEX "intake_contacts_intake_entity_id_idx" ON "intake_contacts"("intake_entity_id");

-- CreateIndex
CREATE INDEX "intake_relationships_from_entity_id_idx" ON "intake_relationships"("from_entity_id");

-- CreateIndex
CREATE INDEX "intake_relationships_to_entity_id_idx" ON "intake_relationships"("to_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_items_intake_session_id_key" ON "verification_items"("intake_session_id");

-- CreateIndex
CREATE INDEX "verification_items_status_idx" ON "verification_items"("status");

-- CreateIndex
CREATE INDEX "verification_items_source_idx" ON "verification_items"("source");

-- CreateIndex
CREATE INDEX "verification_items_entity_type_idx" ON "verification_items"("entity_type");

-- CreateIndex
CREATE INDEX "verification_items_assigned_to_id_idx" ON "verification_items"("assigned_to_id");

-- CreateIndex
CREATE INDEX "verification_items_import_batch_id_idx" ON "verification_items"("import_batch_id");

-- CreateIndex
CREATE INDEX "verification_items_cod_prov_idx" ON "verification_items"("cod_prov");

-- CreateIndex
CREATE INDEX "verification_items_cod_dist_idx" ON "verification_items"("cod_dist");

-- CreateIndex
CREATE INDEX "verification_items_cod_corr_idx" ON "verification_items"("cod_corr");

-- CreateIndex
CREATE INDEX "verification_items_created_at_idx" ON "verification_items"("created_at");

-- CreateIndex
CREATE INDEX "verification_items_status_source_entity_type_idx" ON "verification_items"("status", "source", "entity_type");

-- CreateIndex
CREATE INDEX "verification_items_search_cedula_idx" ON "verification_items"("search_cedula");

-- CreateIndex
CREATE INDEX "verification_items_search_ruc_idx" ON "verification_items"("search_ruc");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_cod_prov_fkey" FOREIGN KEY ("cod_prov") REFERENCES "provincias"("codProv") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_cod_dist_fkey" FOREIGN KEY ("cod_dist") REFERENCES "distritos"("codDist") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_cod_corr_fkey" FOREIGN KEY ("cod_corr") REFERENCES "corregimientos"("codCorr") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "distritos" ADD CONSTRAINT "distritos_codProv_fkey" FOREIGN KEY ("codProv") REFERENCES "provincias"("codProv") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corregimientos" ADD CONSTRAINT "corregimientos_codDist_fkey" FOREIGN KEY ("codDist") REFERENCES "distritos"("codDist") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_entities" ADD CONSTRAINT "intake_entities_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "intake_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_persons" ADD CONSTRAINT "intake_persons_intake_entity_id_fkey" FOREIGN KEY ("intake_entity_id") REFERENCES "intake_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_companies" ADD CONSTRAINT "intake_companies_intake_entity_id_fkey" FOREIGN KEY ("intake_entity_id") REFERENCES "intake_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_contacts" ADD CONSTRAINT "intake_contacts_intake_entity_id_fkey" FOREIGN KEY ("intake_entity_id") REFERENCES "intake_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_relationships" ADD CONSTRAINT "intake_relationships_from_entity_id_fkey" FOREIGN KEY ("from_entity_id") REFERENCES "intake_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_relationships" ADD CONSTRAINT "intake_relationships_to_entity_id_fkey" FOREIGN KEY ("to_entity_id") REFERENCES "intake_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_staging_row_id_fkey" FOREIGN KEY ("staging_row_id") REFERENCES "staging_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_intake_session_id_fkey" FOREIGN KEY ("intake_session_id") REFERENCES "intake_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

