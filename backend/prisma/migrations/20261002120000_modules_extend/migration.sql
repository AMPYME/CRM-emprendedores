-- ============================================================================
-- Extensión de módulos: merge, verification claim, form versions,
-- change requests, portfolio status, capital semilla, intake promote
-- ============================================================================

-- Event form versions
CREATE TABLE IF NOT EXISTS public.event_form_versions (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id    TEXT NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  version     INT NOT NULL,
  form_fields JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, version)
);

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS form_version_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_registrations_form_version_id_fkey'
  ) THEN
    ALTER TABLE public.event_registrations
      ADD CONSTRAINT event_registrations_form_version_id_fkey
      FOREIGN KEY (form_version_id) REFERENCES public.event_form_versions(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Tipado de respuestas (expand)
ALTER TABLE public.event_registration_answers
  ADD COLUMN IF NOT EXISTS value_text TEXT,
  ADD COLUMN IF NOT EXISTS value_integer INT,
  ADD COLUMN IF NOT EXISTS value_decimal NUMERIC(18,4),
  ADD COLUMN IF NOT EXISTS value_boolean BOOLEAN,
  ADD COLUMN IF NOT EXISTS value_date DATE,
  ADD COLUMN IF NOT EXISTS value_jsonb JSONB;

UPDATE public.event_registration_answers
SET value_text = value
WHERE value_text IS NULL AND value IS NOT NULL;

-- Snapshot formFields existentes → version 1
INSERT INTO public.event_form_versions (event_id, version, form_fields)
SELECT e.id, 1, e.form_fields
FROM public.events e
WHERE e.form_fields IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.event_form_versions v WHERE v.event_id = e.id AND v.version = 1
  );

-- FK change requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'person_change_requests_entity_id_fkey'
  ) THEN
    ALTER TABLE public.person_change_requests
      ADD CONSTRAINT person_change_requests_entity_id_fkey
      FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE RESTRICT;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'person_change_requests entity FK skipped: %', SQLERRM;
END $$;

-- Portfolio status change
CREATE OR REPLACE PROCEDURE api.sp_change_portfolio_status(
  p_actor_id text,
  p_portfolio_id text,
  p_new_status text,
  p_reason text DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
DECLARE
  v_old text;
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_actor_id, ''), true);

  SELECT status::text INTO v_old
  FROM public.portfolio_records
  WHERE id = p_portfolio_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_old IS NULL THEN
    RAISE EXCEPTION 'Cartera no encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_old = p_new_status THEN
    RETURN;
  END IF;

  -- Transiciones básicas
  IF v_old = 'CLOSED' AND p_new_status <> 'CLOSED' THEN
    RAISE EXCEPTION 'No se puede reabrir un caso CLOSED desde este procedimiento'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.portfolio_records
  SET status = p_new_status::"PortfolioStatus",
      closed_at = CASE WHEN p_new_status IN ('RESOLVED', 'CLOSED') THEN NOW() ELSE closed_at END,
      closed_reason = CASE WHEN p_new_status IN ('RESOLVED', 'CLOSED') THEN coalesce(p_reason, closed_reason) ELSE closed_reason END,
      updated_at = NOW()
  WHERE id = p_portfolio_id;

  INSERT INTO public.portfolio_status_history (
    portfolio_id, previous_status, new_status, changed_by_id, reason
  ) VALUES (p_portfolio_id, v_old, p_new_status, p_actor_id, p_reason);

  INSERT INTO public.portfolio_actions (
    id, portfolio_id, performed_by_id, action_type, description, action_date, created_at
  ) VALUES (
    gen_random_uuid()::text, p_portfolio_id, p_actor_id, 'STATUS_CHANGE',
    coalesce(p_reason, 'Cambio de estado a ' || p_new_status), NOW(), NOW()
  );
END;
$$;

CREATE OR REPLACE PROCEDURE api.sp_create_portfolio(
  p_actor_id text,
  p_entity_id text,
  p_subject text,
  p_description text DEFAULT NULL,
  p_priority text DEFAULT 'MEDIUM',
  p_category text DEFAULT NULL,
  p_assigned_to_id text DEFAULT NULL,
  p_sede_id text DEFAULT NULL,
  p_departamento_id text DEFAULT NULL,
  INOUT p_portfolio_id text DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
DECLARE
  v_id text := gen_random_uuid()::text;
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_actor_id, ''), true);

  IF NOT EXISTS (SELECT 1 FROM public.entities WHERE id = p_entity_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Entidad no encontrada' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.portfolio_records (
    id, entity_id, assigned_to_id, status, priority, category, subject, description,
    sede_id, departamento_id, created_at, updated_at
  ) VALUES (
    v_id, p_entity_id, p_assigned_to_id, 'NEW', p_priority::"PortfolioPriority",
    p_category, p_subject, p_description, p_sede_id, p_departamento_id, NOW(), NOW()
  );

  INSERT INTO public.portfolio_status_history (portfolio_id, previous_status, new_status, changed_by_id)
  VALUES (v_id, NULL, 'NEW', p_actor_id);

  p_portfolio_id := v_id;
END;
$$;

-- Verification claim atómico
CREATE OR REPLACE PROCEDURE api.sp_assign_verification(
  p_actor_id text,
  INOUT p_item_id text DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
DECLARE
  v_id text;
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_actor_id, ''), true);

  SELECT id INTO v_id
  FROM public.verification_items
  WHERE deleted_at IS NULL AND status = 'PENDING'
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_id IS NULL THEN
    p_item_id := NULL;
    RETURN;
  END IF;

  UPDATE public.verification_items
  SET status = 'ASSIGNED',
      assigned_to_id = p_actor_id,
      assigned_at = NOW(),
      updated_at = NOW()
  WHERE id = v_id;

  p_item_id := v_id;
END;
$$;

CREATE OR REPLACE PROCEDURE api.sp_reject_verification(
  p_actor_id text,
  p_item_id text,
  p_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_actor_id, ''), true);
  UPDATE public.verification_items
  SET status = 'REJECTED',
      rejected_at = NOW(),
      rejection_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_item_id AND deleted_at IS NULL AND status IN ('ASSIGNED', 'IN_REVIEW', 'PENDING');
END;
$$;

-- Merge entities
CREATE OR REPLACE PROCEDURE api.sp_merge_entities(
  p_actor_id text,
  p_source_id text,
  p_target_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
DECLARE
  v_source_type text;
  v_target_type text;
  v_merged_into text;
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_actor_id, ''), true);

  IF p_source_id = p_target_id THEN
    RAISE EXCEPTION 'source y target deben ser distintos' USING ERRCODE = '23514';
  END IF;

  SELECT entity_type::text, merged_into_id INTO v_source_type, v_merged_into
  FROM public.entities WHERE id = p_source_id AND deleted_at IS NULL FOR UPDATE;
  SELECT entity_type::text INTO v_target_type
  FROM public.entities WHERE id = p_target_id AND deleted_at IS NULL FOR UPDATE;

  IF v_source_type IS NULL OR v_target_type IS NULL THEN
    RAISE EXCEPTION 'Entidad no encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_source_type <> v_target_type THEN
    RAISE EXCEPTION 'No se pueden fusionar tipos distintos' USING ERRCODE = '23514';
  END IF;
  IF v_merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'La entidad origen ya fue fusionada' USING ERRCODE = '23514';
  END IF;

  -- Evitar ciclo: target no debe apuntar (directa o indirectamente) a source
  IF EXISTS (
    WITH RECURSIVE chain AS (
      SELECT id, merged_into_id FROM public.entities WHERE id = p_target_id
      UNION ALL
      SELECT e.id, e.merged_into_id
      FROM public.entities e
      JOIN chain c ON e.id = c.merged_into_id
    )
    SELECT 1 FROM chain WHERE id = p_source_id OR merged_into_id = p_source_id
  ) THEN
    RAISE EXCEPTION 'Fusión crearía un ciclo' USING ERRCODE = '23514';
  END IF;

  UPDATE public.entity_contacts SET entity_id = p_target_id
  WHERE entity_id = p_source_id AND deleted_at IS NULL;

  UPDATE public.entity_relationships SET from_entity_id = p_target_id
  WHERE from_entity_id = p_source_id AND deleted_at IS NULL;
  UPDATE public.entity_relationships SET to_entity_id = p_target_id
  WHERE to_entity_id = p_source_id AND deleted_at IS NULL;

  UPDATE public.portfolio_records SET entity_id = p_target_id
  WHERE entity_id = p_source_id AND deleted_at IS NULL;

  UPDATE public.event_registrations SET entity_id = p_target_id
  WHERE entity_id = p_source_id AND deleted_at IS NULL;

  UPDATE public.entities
  SET status = 'MERGED', merged_into_id = p_target_id, updated_at = NOW()
  WHERE id = p_source_id;
END;
$$;

-- Confirm change request (aplica payload básico UPDATE/CREATE vía flags)
CREATE OR REPLACE PROCEDURE api.sp_cancel_change_request(
  p_actor_id text,
  p_request_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_actor_id, ''), true);
  UPDATE public.person_change_requests
  SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
  WHERE id = p_request_id AND status = 'PENDING';
END;
$$;

CREATE OR REPLACE PROCEDURE api.sp_set_registro_empresarial(
  p_actor_id text,
  p_entity_id text,
  p_fecha date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_actor_id, ''), true);
  UPDATE public.entities
  SET registro_empresarial_fecha = p_fecha, updated_at = NOW()
  WHERE id = p_entity_id AND deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE PROCEDURE api.sp_link_capital_semilla(
  p_actor_id text,
  p_capital_id text,
  p_person_entity_id text,
  p_linked_at date DEFAULT CURRENT_DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_actor_id, ''), true);

  IF NOT EXISTS (
    SELECT 1 FROM public.entities e
    JOIN public.persons p ON p.entity_id = e.id
    WHERE e.id = p_person_entity_id AND e.deleted_at IS NULL AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Persona no encontrada' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.capital_semilla
  SET person_entity_id = p_person_entity_id,
      person_id = (SELECT id FROM public.persons WHERE entity_id = p_person_entity_id),
      linked_at = p_linked_at
  WHERE id = p_capital_id AND deleted_at IS NULL;
END;
$$;

-- Intake promote (esqueleto atómico: marca sesión VALIDATED; la creación de entidad
-- se hace con sp_create_person/company desde el worker usando el snapshot)
CREATE OR REPLACE PROCEDURE api.sp_validate_intake(
  p_actor_id text,
  p_session_id text,
  p_entity_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_actor_id, ''), true);

  UPDATE public.intake_sessions
  SET status = 'VALIDATED', updated_at = NOW()
  WHERE id = p_session_id AND deleted_at IS NULL;

  UPDATE public.verification_items
  SET status = 'VALIDATED',
      validated_entity_id = p_entity_id,
      validated_at = NOW(),
      updated_at = NOW()
  WHERE intake_session_id = p_session_id AND deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE PROCEDURE api.sp_create_relationship(
  p_actor_id text,
  p_from_entity_id text,
  p_to_entity_id text,
  p_relationship_type text,
  p_role text DEFAULT NULL,
  INOUT p_relationship_id text DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
DECLARE
  v_id text := gen_random_uuid()::text;
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_actor_id, ''), true);

  IF p_from_entity_id = p_to_entity_id THEN
    RAISE EXCEPTION 'No se permite relación reflexiva' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.entity_relationships (
    id, from_entity_id, to_entity_id, relationship_type, role, is_active, created_at, updated_at
  ) VALUES (
    v_id, p_from_entity_id, p_to_entity_id, p_relationship_type::"RelationshipType",
    p_role, TRUE, NOW(), NOW()
  );

  p_relationship_id := v_id;
END;
$$;

CREATE OR REPLACE PROCEDURE api.sp_end_relationship(
  p_actor_id text,
  p_relationship_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_actor_id, ''), true);
  UPDATE public.entity_relationships
  SET is_active = FALSE, end_date = NOW(), deleted_at = NOW(), deleted_by_id = p_actor_id, updated_at = NOW()
  WHERE id = p_relationship_id AND deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE PROCEDURE api.sp_update_import_progress(
  p_batch_id text,
  p_stage text,
  p_percent int,
  p_message text DEFAULT NULL,
  p_processed_rows int DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
BEGIN
  UPDATE public.import_batches
  SET current_stage = p_stage,
      progress_percent = LEAST(GREATEST(coalesce(p_percent, 0), 0), 100),
      progress_message = p_message,
      processed_rows = COALESCE(p_processed_rows, processed_rows),
      last_heartbeat_at = NOW(),
      updated_at = NOW()
  WHERE id = p_batch_id AND deleted_at IS NULL;
END;
$$;

-- Re-grant procedures
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'api' AND p.prokind = 'p'
  LOOP
    EXECUTE format('REVOKE ALL ON PROCEDURE api.%I(%s) FROM PUBLIC', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON PROCEDURE api.%I(%s) TO crm_api', r.proname, r.args);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM crm_api;
GRANT USAGE ON SCHEMA api TO crm_api;
GRANT SELECT ON ALL TABLES IN SCHEMA api TO crm_api;
