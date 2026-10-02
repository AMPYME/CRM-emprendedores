-- ============================================================================
-- Fundación arquitectura CRM: schemas, roles, geo, documento, soft delete, auditoría
-- Expand-contract: columnas nuevas + catálogos; tablas de negocio siguen en public
-- (reubicación a core.* en cutover posterior). Prisma sigue mapeando public.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Schemas
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS security;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS crm;
CREATE SCHEMA IF NOT EXISTS events;
CREATE SCHEMA IF NOT EXISTS imports;
CREATE SCHEMA IF NOT EXISTS verification;
CREATE SCHEMA IF NOT EXISTS intake;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS integration;
CREATE SCHEMA IF NOT EXISTS api;
CREATE SCHEMA IF NOT EXISTS workflow;

-- ---------------------------------------------------------------------------
-- 2. Roles
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_owner') THEN
    CREATE ROLE crm_owner NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_migrator') THEN
    CREATE ROLE crm_migrator LOGIN
      PASSWORD 'cambiar_crm_migrator'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_api') THEN
    CREATE ROLE crm_api LOGIN
      PASSWORD 'cambiar_crm_api'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_readonly_admin') THEN
    CREATE ROLE crm_readonly_admin LOGIN
      PASSWORD 'cambiar_crm_readonly_admin'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;

GRANT crm_owner TO CURRENT_USER;
-- CONNECT: en PostgreSQL el privilegio por defecto para PUBLIC suele bastar.
-- Si se revoca PUBLIC, conceder explícitamente:
--   GRANT CONNECT ON DATABASE emprendedores_db TO crm_migrator, crm_api, crm_readonly_admin;

-- Migrator: DDL en todos los schemas de negocio
GRANT USAGE, CREATE ON SCHEMA catalog, security, core, crm, events, imports,
  verification, intake, audit, integration, api, workflow, public TO crm_migrator;

-- API: solo schema api (USAGE). SELECT/EXECUTE se conceden tras crear objetos.
GRANT USAGE ON SCHEMA api TO crm_api;
GRANT USAGE ON SCHEMA api TO crm_readonly_admin;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM crm_api;
REVOKE CREATE ON SCHEMA public FROM crm_readonly_admin;

-- ---------------------------------------------------------------------------
-- 3. Extensiones
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- 4. Catálogo geográfico unificado
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE catalog.political_division_level AS ENUM ('PROVINCE', 'DISTRICT', 'CORREGIMIENTO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS catalog.political_divisions (
  code        VARCHAR(6) PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  level       catalog.political_division_level NOT NULL,
  parent_code VARCHAR(6) REFERENCES catalog.political_divisions(code) ON DELETE RESTRICT ON UPDATE CASCADE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT political_divisions_code_digits_chk
    CHECK (code ~ '^[0-9]+$'),
  CONSTRAINT political_divisions_code_len_chk
    CHECK (length(code) IN (2, 4, 6)),
  CONSTRAINT political_divisions_level_len_chk
    CHECK (
      (level = 'PROVINCE' AND length(code) = 2 AND parent_code IS NULL)
      OR (level = 'DISTRICT' AND length(code) = 4 AND parent_code IS NOT NULL AND length(parent_code) = 2)
      OR (level = 'CORREGIMIENTO' AND length(code) = 6 AND parent_code IS NOT NULL AND length(parent_code) = 4)
    ),
  CONSTRAINT political_divisions_parent_prefix_chk
    CHECK (parent_code IS NULL OR left(code, length(parent_code)) = parent_code)
);

CREATE INDEX IF NOT EXISTS political_divisions_parent_idx
  ON catalog.political_divisions (parent_code);
CREATE INDEX IF NOT EXISTS political_divisions_level_idx
  ON catalog.political_divisions (level)
  WHERE is_active;

-- Backfill desde catálogos actuales
INSERT INTO catalog.political_divisions (code, name, level, parent_code)
SELECT p."codProv", p.nombre, 'PROVINCE'::catalog.political_division_level, NULL
FROM public.provincias p
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();

INSERT INTO catalog.political_divisions (code, name, level, parent_code)
SELECT d."codDist", d.nombre, 'DISTRICT'::catalog.political_division_level, d."codProv"
FROM public.distritos d
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_code = EXCLUDED.parent_code, updated_at = NOW();

INSERT INTO catalog.political_divisions (code, name, level, parent_code)
SELECT c."codCorr", c.nombre, 'CORREGIMIENTO'::catalog.political_division_level, c."codDist"
FROM public.corregimientos c
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, parent_code = EXCLUDED.parent_code, updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 5. Catálogos auxiliares
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalog.data_sources (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code       VARCHAR(64) NOT NULL UNIQUE,
  name       VARCHAR(150) NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO catalog.data_sources (code, name) VALUES
  ('MANUAL', 'Alta manual'),
  ('SIEP', 'API SIEP'),
  ('CAPITAL_SEMILLA', 'Capital Semilla'),
  ('REGISTRO_EMPRESARIAL', 'Registro empresarial'),
  ('IMPORT', 'Importación masiva'),
  ('EVENT_IMPORT', 'Importación de evento'),
  ('INTAKE', 'Captura pública / intake'),
  ('EMPRENDEDORES_INTAKE', 'Intake emprendedores')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS catalog.economic_activities (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code        VARCHAR(32) NOT NULL UNIQUE,
  name        VARCHAR(200) NOT NULL,
  parent_code VARCHAR(32),
  level       INT NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO catalog.economic_activities (code, name, level) VALUES
  ('SIN_CLASIFICAR', 'Sin clasificar', 1)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS catalog.company_types (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code       VARCHAR(32) NOT NULL UNIQUE,
  name       VARCHAR(120) NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO catalog.company_types (code, name) VALUES
  ('SA', 'Sociedad Anónima'),
  ('SRL', 'Sociedad de Responsabilidad Limitada'),
  ('SEP', 'Sociedad de Emprendimiento'),
  ('INC', 'Incorporated'),
  ('CORP', 'Corporation'),
  ('OTRO', 'Otro')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS catalog.roles (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code        VARCHAR(64) NOT NULL UNIQUE,
  name        VARCHAR(120) NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO catalog.roles (code, name) VALUES
  ('SUPER_ADMIN', 'Super administrador'),
  ('ADMIN', 'Administrador'),
  ('EMPREND_ADMIN', 'Admin emprendedores'),
  ('EMPREND_OPERADOR', 'Operador'),
  ('EMPREND_VIEWER', 'Solo lectura')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS catalog.permissions (
  id   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog.role_permissions (
  role_id       TEXT NOT NULL REFERENCES catalog.roles(id) ON DELETE RESTRICT,
  permission_id TEXT NOT NULL REFERENCES catalog.permissions(id) ON DELETE RESTRICT,
  PRIMARY KEY (role_id, permission_id)
);

-- ---------------------------------------------------------------------------
-- 6. Soft delete + geo canónica + documento normalizado (expand)
-- ---------------------------------------------------------------------------
ALTER TABLE public.entities
  ADD COLUMN IF NOT EXISTS political_division_code VARCHAR(6),
  ADD COLUMN IF NOT EXISTS address_line TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_id TEXT,
  ADD COLUMN IF NOT EXISTS delete_reason TEXT,
  ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS restored_by_id TEXT,
  ADD COLUMN IF NOT EXISTS data_source_id TEXT;

-- Backfill address_line
UPDATE public.entities
SET address_line = address
WHERE address_line IS NULL AND address IS NOT NULL;

-- Backfill political_division_code (corregimiento > distrito > provincia)
UPDATE public.entities e
SET political_division_code = COALESCE(e.cod_corr, e.cod_dist, e.cod_prov)
WHERE e.political_division_code IS NULL
  AND COALESCE(e.cod_corr, e.cod_dist, e.cod_prov) IS NOT NULL;

-- FK geo (solo códigos existentes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entities_political_division_code_fkey'
  ) THEN
    ALTER TABLE public.entities
      ADD CONSTRAINT entities_political_division_code_fkey
      FOREIGN KEY (political_division_code)
      REFERENCES catalog.political_divisions(code)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE public.entities
  DROP CONSTRAINT IF EXISTS entities_political_division_code_len_chk;
ALTER TABLE public.entities
  ADD CONSTRAINT entities_political_division_code_len_chk
  CHECK (
    political_division_code IS NULL
    OR (
      political_division_code ~ '^[0-9]+$'
      AND length(political_division_code) IN (2, 4, 6)
    )
  );

CREATE INDEX IF NOT EXISTS entities_political_division_code_idx
  ON public.entities (political_division_code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS entities_location_province_idx
  ON public.entities (left(political_division_code, 2))
  WHERE deleted_at IS NULL AND political_division_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS entities_location_district_idx
  ON public.entities (left(political_division_code, 4))
  WHERE deleted_at IS NULL AND political_division_code IS NOT NULL
    AND length(political_division_code) >= 4;

CREATE INDEX IF NOT EXISTS entities_active_type_idx
  ON public.entities (entity_type, status)
  WHERE deleted_at IS NULL;

-- Persons: documento normalizado + soft delete + legacy business name
ALTER TABLE public.persons
  ADD COLUMN IF NOT EXISTS document_number_normalized VARCHAR(40),
  ADD COLUMN IF NOT EXISTS legacy_business_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_id TEXT;

UPDATE public.persons
SET legacy_business_name = business_name
WHERE legacy_business_name IS NULL AND business_name IS NOT NULL;

UPDATE public.persons
SET document_number = COALESCE(document_number, cedula)
WHERE document_number IS NULL AND cedula IS NOT NULL;

UPDATE public.persons
SET document_number_normalized = upper(regexp_replace(coalesce(document_number, cedula, ''), '[^0-9A-Z]', '', 'g'))
WHERE document_number_normalized IS NULL
  AND coalesce(document_number, cedula) IS NOT NULL
  AND btrim(coalesce(document_number, cedula, '')) <> '';

-- Vaciar normalizados vacíos
UPDATE public.persons
SET document_number_normalized = NULL
WHERE document_number_normalized = '';

CREATE UNIQUE INDEX IF NOT EXISTS persons_document_normalized_active_key
  ON public.persons (document_number_normalized)
  WHERE deleted_at IS NULL
    AND document_number_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS persons_document_trgm_idx
  ON public.persons USING gin (document_number gin_trgm_ops);

-- Companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS ruc_normalized VARCHAR(40),
  ADD COLUMN IF NOT EXISTS company_type_id TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_id TEXT;

UPDATE public.companies
SET ruc_normalized = upper(regexp_replace(coalesce(ruc, ''), '[^0-9A-Z]', '', 'g'))
WHERE ruc_normalized IS NULL AND ruc IS NOT NULL AND btrim(ruc) <> '';

UPDATE public.companies SET ruc_normalized = NULL WHERE ruc_normalized = '';

CREATE UNIQUE INDEX IF NOT EXISTS companies_ruc_normalized_active_key
  ON public.companies (ruc_normalized)
  WHERE deleted_at IS NULL AND ruc_normalized IS NOT NULL;

-- Users soft delete / disable
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_id TEXT;

ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

-- Relationships: soft delete + allow multiple types
ALTER TABLE public.entity_relationships
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_id TEXT;

ALTER TABLE public.entity_relationships
  DROP CONSTRAINT IF EXISTS entity_relationships_from_entity_id_to_entity_id_key;

ALTER TABLE public.entity_relationships
  DROP CONSTRAINT IF EXISTS entity_relationships_no_self_chk;
ALTER TABLE public.entity_relationships
  ADD CONSTRAINT entity_relationships_no_self_chk
  CHECK (from_entity_id <> to_entity_id);

ALTER TABLE public.entity_relationships
  DROP CONSTRAINT IF EXISTS entity_relationships_dates_chk;
ALTER TABLE public.entity_relationships
  ADD CONSTRAINT entity_relationships_dates_chk
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);

CREATE UNIQUE INDEX IF NOT EXISTS entity_relationships_active_triple_key
  ON public.entity_relationships (from_entity_id, to_entity_id, relationship_type)
  WHERE deleted_at IS NULL AND is_active = TRUE;

-- Contacts normalized
ALTER TABLE public.entity_contacts
  ADD COLUMN IF NOT EXISTS normalized_value VARCHAR(255);

UPDATE public.entity_contacts
SET normalized_value = CASE
  WHEN contact_type IN ('PHONE', 'MOBILE', 'WHATSAPP')
    THEN regexp_replace(contact_value, '[^0-9]', '', 'g')
  WHEN contact_type = 'EMAIL'
    THEN lower(btrim(contact_value))
  ELSE upper(btrim(contact_value))
END
WHERE normalized_value IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS entity_contacts_primary_active_key
  ON public.entity_contacts (entity_id, contact_type)
  WHERE deleted_at IS NULL AND is_primary = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS entity_contacts_value_active_key
  ON public.entity_contacts (entity_id, contact_type, normalized_value)
  WHERE deleted_at IS NULL AND normalized_value IS NOT NULL;

-- Entity economic activities
CREATE TABLE IF NOT EXISTS public.entity_economic_activities (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entity_id   TEXT NOT NULL REFERENCES public.entities(id) ON DELETE RESTRICT,
  activity_id TEXT NOT NULL REFERENCES catalog.economic_activities(id) ON DELETE RESTRICT,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_id, activity_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS entity_economic_activities_primary_key
  ON public.entity_economic_activities (entity_id)
  WHERE is_primary = TRUE;

-- External references (SIEP, etc.)
CREATE TABLE IF NOT EXISTS public.entity_external_references (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entity_id   TEXT NOT NULL REFERENCES public.entities(id) ON DELETE RESTRICT,
  system      VARCHAR(64) NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (system, external_id)
);

CREATE INDEX IF NOT EXISTS entity_external_references_entity_idx
  ON public.entity_external_references (entity_id);

INSERT INTO public.entity_external_references (entity_id, system, external_id)
SELECT id, 'SIEP', siep_public_id
FROM public.entities
WHERE siep_public_id IS NOT NULL
ON CONFLICT (system, external_id) DO NOTHING;

-- Capital semilla 1:N
ALTER TABLE public.capital_semilla
  ADD COLUMN IF NOT EXISTS person_entity_id TEXT,
  ADD COLUMN IF NOT EXISTS program VARCHAR(120),
  ADD COLUMN IF NOT EXISTS call_year INT,
  ADD COLUMN IF NOT EXISTS awarded_at DATE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

UPDATE public.capital_semilla cs
SET person_entity_id = p.entity_id
FROM public.persons p
WHERE cs.person_id = p.id
  AND cs.person_entity_id IS NULL;

ALTER TABLE public.capital_semilla DROP CONSTRAINT IF EXISTS capital_semilla_person_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'capital_semilla_person_entity_id_fkey'
  ) THEN
    ALTER TABLE public.capital_semilla
      ADD CONSTRAINT capital_semilla_person_entity_id_fkey
      FOREIGN KEY (person_entity_id) REFERENCES public.entities(id) ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE public.capital_semilla
  DROP CONSTRAINT IF EXISTS capital_semilla_amount_chk;
ALTER TABLE public.capital_semilla
  ADD CONSTRAINT capital_semilla_amount_chk
  CHECK (amount IS NULL OR amount >= 0);

-- Portfolio soft delete + status history
ALTER TABLE public.portfolio_records
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_id TEXT;

CREATE TABLE IF NOT EXISTS public.portfolio_status_history (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  portfolio_id     TEXT NOT NULL REFERENCES public.portfolio_records(id) ON DELETE RESTRICT,
  previous_status  TEXT,
  new_status       TEXT NOT NULL,
  changed_by_id    TEXT,
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason           TEXT
);

CREATE INDEX IF NOT EXISTS portfolio_status_history_portfolio_idx
  ON public.portfolio_status_history (portfolio_id, changed_at DESC);

-- Import progress fields
ALTER TABLE public.import_batches
  ADD COLUMN IF NOT EXISTS current_stage VARCHAR(64),
  ADD COLUMN IF NOT EXISTS progress_percent INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_message TEXT,
  ADD COLUMN IF NOT EXISTS processed_rows INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;

ALTER TABLE public.import_batches
  DROP CONSTRAINT IF EXISTS import_batches_progress_chk;
ALTER TABLE public.import_batches
  ADD CONSTRAINT import_batches_progress_chk
  CHECK (progress_percent IS NULL OR (progress_percent >= 0 AND progress_percent <= 100));

ALTER TABLE public.staging_rows
  DROP CONSTRAINT IF EXISTS staging_rows_match_score_chk;
ALTER TABLE public.staging_rows
  ADD CONSTRAINT staging_rows_match_score_chk
  CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 1));

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_employee_count_chk;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_employee_count_chk
  CHECK (employee_count IS NULL OR employee_count >= 0);

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_dates_chk;
ALTER TABLE public.events
  ADD CONSTRAINT events_dates_chk
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_capacity_chk;
ALTER TABLE public.events
  ADD CONSTRAINT events_capacity_chk
  CHECK (max_capacity IS NULL OR max_capacity >= 0);

-- Verification political_division_code
ALTER TABLE public.verification_items
  ADD COLUMN IF NOT EXISTS political_division_code VARCHAR(6);

UPDATE public.verification_items
SET political_division_code = COALESCE(cod_corr, cod_dist, cod_prov)
WHERE political_division_code IS NULL;

-- User roles (1 activo)
CREATE TABLE IF NOT EXISTS security.user_roles (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  role_id     TEXT NOT NULL REFERENCES catalog.roles(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_one_active_key
  ON security.user_roles (user_id)
  WHERE deleted_at IS NULL;

INSERT INTO security.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM public.users u
JOIN catalog.roles r ON r.code = u.role::text
WHERE NOT EXISTS (
  SELECT 1 FROM security.user_roles ur WHERE ur.user_id = u.id AND ur.deleted_at IS NULL
);

-- Outbox
CREATE TABLE IF NOT EXISTS integration.outbox_events (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  aggregate_type VARCHAR(64) NOT NULL,
  aggregate_id   TEXT NOT NULL,
  event_type     VARCHAR(64) NOT NULL,
  payload        JSONB NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at   TIMESTAMPTZ,
  attempts       INT NOT NULL DEFAULT 0,
  last_error     TEXT
);

CREATE INDEX IF NOT EXISTS outbox_events_pending_idx
  ON integration.outbox_events (created_at)
  WHERE processed_at IS NULL;

-- ---------------------------------------------------------------------------
-- 7. Auditoría append-only
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit.change_log (
  id               BIGSERIAL PRIMARY KEY,
  schema_name      TEXT NOT NULL,
  table_name       TEXT NOT NULL,
  record_id        TEXT,
  action           TEXT NOT NULL,
  old_data         JSONB,
  new_data         JSONB,
  changed_fields   JSONB,
  actor_user_id    TEXT,
  actor_username   TEXT,
  request_id       TEXT,
  ip_address       TEXT,
  application_name TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS change_log_table_record_idx
  ON audit.change_log (schema_name, table_name, record_id);
CREATE INDEX IF NOT EXISTS change_log_created_idx
  ON audit.change_log (created_at DESC);
CREATE INDEX IF NOT EXISTS change_log_actor_idx
  ON audit.change_log (actor_user_id);

CREATE TABLE IF NOT EXISTS audit.security_events (
  id               BIGSERIAL PRIMARY KEY,
  event_type       TEXT NOT NULL,
  user_id          TEXT,
  username         TEXT,
  ip_address       TEXT,
  user_agent       TEXT,
  details          JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS security_events_created_idx
  ON audit.security_events (created_at DESC);

CREATE OR REPLACE FUNCTION audit.fn_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = audit, pg_temp
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_changed jsonb := '{}'::jsonb;
  v_key text;
  v_actor text;
  v_request text;
  v_record_id text;
  v_action text;
BEGIN
  v_actor := nullif(current_setting('app.user_id', true), '');
  v_request := nullif(current_setting('app.request_id', true), '');

  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_new := to_jsonb(NEW);
    v_old := NULL;
    v_record_id := COALESCE(v_new->>'id', v_new->>'entity_id');
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := COALESCE(v_new->>'id', v_new->>'entity_id');
    IF (v_old ? 'deleted_at') AND (v_old->>'deleted_at') IS NULL AND (v_new->>'deleted_at') IS NOT NULL THEN
      v_action := 'SOFT_DELETE';
    ELSIF (v_old ? 'deleted_at') AND (v_old->>'deleted_at') IS NOT NULL AND (v_new->>'deleted_at') IS NULL THEN
      v_action := 'RESTORE';
    ELSE
      v_action := 'UPDATE';
    END IF;
    FOR v_key IN SELECT jsonb_object_keys(v_new)
    LOOP
      IF v_old->v_key IS DISTINCT FROM v_new->v_key THEN
        v_changed := v_changed || jsonb_build_object(v_key, jsonb_build_object('old', v_old->v_key, 'new', v_new->v_key));
      END IF;
    END LOOP;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_record_id := COALESCE(v_old->>'id', v_old->>'entity_id');
  END IF;

  INSERT INTO audit.change_log (
    schema_name, table_name, record_id, action,
    old_data, new_data, changed_fields,
    actor_user_id, request_id, application_name
  ) VALUES (
    TG_TABLE_SCHEMA, TG_TABLE_NAME, v_record_id, v_action,
    v_old, v_new, NULLIF(v_changed, '{}'::jsonb),
    v_actor, v_request, current_setting('application_name', true)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION audit.fn_audit_trigger() FROM PUBLIC;

-- Soft-delete: expand anti-DELETE a entities/persons/companies/users/relationships/portfolio
CREATE OR REPLACE FUNCTION public.fn_reject_physical_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(current_setting('app.allow_physical_delete', true), '') = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Borrado físico no permitido en %. Use soft delete.', TG_TABLE_NAME
    USING ERRCODE = '23001';
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'entities', 'persons', 'companies', 'users', 'entity_relationships',
    'portfolio_records', 'portfolio_actions', 'capital_semilla', 'sedes', 'departamentos',
    'person_change_requests', 'events', 'event_registration_answers'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_no_delete ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_no_delete BEFORE DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.fn_reject_physical_delete()',
      t, t
    );
  END LOOP;
END $$;

-- Audit triggers on critical tables
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'entities', 'persons', 'companies', 'entity_contacts', 'entity_relationships',
    'users', 'portfolio_records', 'portfolio_actions', 'verification_items',
    'import_batches', 'capital_semilla', 'person_change_requests', 'event_registrations'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_audit ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION audit.fn_audit_trigger()',
      t, t
    );
  END LOOP;
END $$;

-- Append-only audit
REVOKE UPDATE, DELETE ON audit.change_log FROM PUBLIC;
REVOKE UPDATE, DELETE ON audit.security_events FROM PUBLIC;
REVOKE TRUNCATE ON audit.change_log FROM PUBLIC;
REVOKE TRUNCATE ON audit.security_events FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 8. TPT enforcement
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.fn_enforce_tpt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type text;
  v_has_person boolean;
  v_has_company boolean;
  v_entity_id text;
BEGIN
  IF TG_TABLE_NAME = 'entities' THEN
    v_entity_id := NEW.id;
    v_type := NEW.entity_type::text;
  ELSIF TG_TABLE_NAME = 'persons' THEN
    v_entity_id := NEW.entity_id;
  ELSIF TG_TABLE_NAME = 'companies' THEN
    v_entity_id := NEW.entity_id;
  END IF;

  SELECT e.entity_type::text INTO v_type FROM public.entities e WHERE e.id = v_entity_id;
  IF v_type IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.persons p WHERE p.entity_id = v_entity_id AND p.deleted_at IS NULL)
    INTO v_has_person;
  SELECT EXISTS(SELECT 1 FROM public.companies c WHERE c.entity_id = v_entity_id AND c.deleted_at IS NULL)
    INTO v_has_company;

  IF v_type = 'PERSON' AND v_has_company THEN
    RAISE EXCEPTION 'TPT: entity PERSON no puede tener company'
      USING ERRCODE = '23514';
  END IF;
  IF v_type = 'COMPANY' AND v_has_person THEN
    RAISE EXCEPTION 'TPT: entity COMPANY no puede tener person'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_persons_tpt ON public.persons;
CREATE TRIGGER trg_persons_tpt
  AFTER INSERT OR UPDATE ON public.persons
  FOR EACH ROW EXECUTE FUNCTION core.fn_enforce_tpt();

DROP TRIGGER IF EXISTS trg_companies_tpt ON public.companies;
CREATE TRIGGER trg_companies_tpt
  AFTER INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION core.fn_enforce_tpt();

-- display_name sync
CREATE OR REPLACE FUNCTION core.fn_sync_display_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
BEGIN
  IF TG_TABLE_NAME = 'persons' THEN
    v_name := btrim(concat_ws(' ', NEW.first_name, NEW.last_name, NEW.second_last_name));
    UPDATE public.entities SET display_name = v_name, updated_at = NOW()
    WHERE id = NEW.entity_id AND display_name IS DISTINCT FROM v_name;
  ELSIF TG_TABLE_NAME = 'companies' THEN
    v_name := COALESCE(NULLIF(btrim(NEW.trade_name), ''), NEW.legal_name);
    UPDATE public.entities SET display_name = v_name, updated_at = NOW()
    WHERE id = NEW.entity_id AND display_name IS DISTINCT FROM v_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_persons_display_name ON public.persons;
CREATE TRIGGER trg_persons_display_name
  AFTER INSERT OR UPDATE OF first_name, last_name, second_last_name ON public.persons
  FOR EACH ROW EXECUTE FUNCTION core.fn_sync_display_name();

DROP TRIGGER IF EXISTS trg_companies_display_name ON public.companies;
CREATE TRIGGER trg_companies_display_name
  AFTER INSERT OR UPDATE OF legal_name, trade_name ON public.companies
  FOR EACH ROW EXECUTE FUNCTION core.fn_sync_display_name();

-- Default privileges: futuras tablas no accesibles a crm_api
ALTER DEFAULT PRIVILEGES FOR ROLE crm_migrator IN SCHEMA public
  REVOKE ALL ON TABLES FROM crm_api;
ALTER DEFAULT PRIVILEGES FOR ROLE crm_migrator IN SCHEMA catalog
  REVOKE ALL ON TABLES FROM crm_api;
ALTER DEFAULT PRIVILEGES FOR ROLE crm_migrator IN SCHEMA audit
  REVOKE ALL ON TABLES FROM crm_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM crm_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA catalog
  REVOKE ALL ON TABLES FROM crm_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit
  REVOKE ALL ON TABLES FROM PUBLIC;

COMMENT ON SCHEMA api IS 'Frontera Backend: solo views/functions/procedures';
COMMENT ON SCHEMA audit IS 'Auditoría append-only por triggers';
COMMENT ON SCHEMA catalog IS 'Catálogos institucionales';
