-- ============================================================================
-- Contrato API: views, functions, procedures + grants a crm_api
-- ============================================================================

-- Contexto de auditoría / actor
CREATE OR REPLACE PROCEDURE api.sp_set_app_context(
  p_user_id text,
  p_request_id text DEFAULT NULL,
  p_ip_address text DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_user_id, ''), true);
  PERFORM set_config('app.request_id', coalesce(p_request_id, ''), true);
  IF p_ip_address IS NOT NULL THEN
    PERFORM set_config('app.ip_address', p_ip_address, true);
  END IF;
END;
$$;

REVOKE ALL ON PROCEDURE api.sp_set_app_context(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON PROCEDURE api.sp_set_app_context(text, text, text) TO crm_api;

-- Normalización documento
CREATE OR REPLACE FUNCTION api.fn_normalize_document(p_doc text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(upper(regexp_replace(coalesce(p_doc, ''), '[^0-9A-Z]', '', 'g')), '');
$$;

REVOKE ALL ON FUNCTION api.fn_normalize_document(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.fn_normalize_document(text) TO crm_api;

-- Ubicación derivada
CREATE OR REPLACE FUNCTION api.fn_get_location(p_code text)
RETURNS TABLE (
  political_division_code varchar(6),
  province_code varchar(6),
  province_name varchar(150),
  district_code varchar(6),
  district_name varchar(150),
  corregimiento_code varchar(6),
  corregimiento_name varchar(150),
  level catalog.political_division_level
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = catalog, pg_temp
AS $$
  SELECT
    d.code,
    left(d.code, 2)::varchar(6),
    p.name,
    CASE WHEN length(d.code) >= 4 THEN left(d.code, 4)::varchar(6) END,
    di.name,
    CASE WHEN length(d.code) = 6 THEN d.code END,
    CASE WHEN d.level = 'CORREGIMIENTO' THEN d.name END,
    d.level
  FROM catalog.political_divisions d
  LEFT JOIN catalog.political_divisions p ON p.code = left(d.code, 2) AND p.level = 'PROVINCE'
  LEFT JOIN catalog.political_divisions di ON length(d.code) >= 4 AND di.code = left(d.code, 4) AND di.level = 'DISTRICT'
  WHERE d.code = p_code;
$$;

REVOKE ALL ON FUNCTION api.fn_get_location(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.fn_get_location(text) TO crm_api, crm_readonly_admin;

-- Views personas
CREATE OR REPLACE VIEW api.v_person_summary AS
SELECT
  e.id AS entity_id,
  e.status,
  e.display_name,
  e.political_division_code,
  loc.province_code,
  loc.province_name,
  loc.district_code,
  loc.district_name,
  loc.corregimiento_code,
  loc.corregimiento_name,
  e.address_line,
  e.registro_empresarial_fecha,
  e.siep_public_id,
  e.source_origin,
  e.created_at,
  e.updated_at,
  p.document_type,
  p.document_number,
  p.document_number_normalized,
  p.first_name,
  p.last_name,
  p.second_last_name,
  p.gender,
  p.birth_date,
  p.nationality_code,
  p.education_level,
  p.occupation,
  p.legacy_business_name,
  p.has_artisan_card
FROM public.entities e
JOIN public.persons p ON p.entity_id = e.id
LEFT JOIN LATERAL api.fn_get_location(e.political_division_code) loc ON TRUE
WHERE e.entity_type = 'PERSON'
  AND e.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND e.status <> 'MERGED';

CREATE OR REPLACE VIEW api.v_person_detail AS
SELECT * FROM api.v_person_summary;

CREATE OR REPLACE VIEW api.v_company_summary AS
SELECT
  e.id AS entity_id,
  e.status,
  e.display_name,
  e.political_division_code,
  loc.province_code,
  loc.province_name,
  loc.district_code,
  loc.district_name,
  loc.corregimiento_code,
  loc.corregimiento_name,
  e.address_line,
  e.registro_empresarial_fecha,
  e.siep_public_id,
  e.source_origin,
  e.created_at,
  e.updated_at,
  c.ruc,
  c.dv,
  c.ruc_normalized,
  c.legal_name,
  c.trade_name,
  c.company_type,
  c.company_size_class,
  c.founded_date,
  c.employee_count
FROM public.entities e
JOIN public.companies c ON c.entity_id = e.id
LEFT JOIN LATERAL api.fn_get_location(e.political_division_code) loc ON TRUE
WHERE e.entity_type = 'COMPANY'
  AND e.deleted_at IS NULL
  AND c.deleted_at IS NULL
  AND e.status <> 'MERGED';

CREATE OR REPLACE VIEW api.v_company_detail AS
SELECT * FROM api.v_company_summary;

CREATE OR REPLACE VIEW api.v_entity_contacts AS
SELECT
  id,
  entity_id,
  contact_type,
  contact_value,
  normalized_value,
  label,
  is_primary,
  is_verified,
  created_at,
  updated_at
FROM public.entity_contacts
WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW api.v_entity_location AS
SELECT
  e.id AS entity_id,
  e.political_division_code,
  loc.province_code,
  loc.province_name,
  loc.district_code,
  loc.district_name,
  loc.corregimiento_code,
  loc.corregimiento_name,
  e.address_line
FROM public.entities e
LEFT JOIN LATERAL api.fn_get_location(e.political_division_code) loc ON TRUE
WHERE e.deleted_at IS NULL;

CREATE OR REPLACE VIEW api.v_user_detail AS
SELECT
  u.id,
  u.email,
  u.username,
  u.first_name,
  u.last_name,
  u.role,
  u.is_active,
  u.sede_id,
  s.name AS sede_name,
  u.departamento_id,
  d.name AS departamento_name,
  u.last_login_at,
  u.created_at,
  u.disabled_at
FROM public.users u
LEFT JOIN public.sedes s ON s.id = u.sede_id AND s.deleted_at IS NULL
LEFT JOIN public.departamentos d ON d.id = u.departamento_id AND d.deleted_at IS NULL
WHERE u.deleted_at IS NULL;

CREATE OR REPLACE VIEW api.v_portfolio_summary AS
SELECT
  pr.id,
  pr.entity_id,
  e.display_name AS entity_display_name,
  pr.assigned_to_id,
  pr.status,
  pr.priority,
  pr.category,
  pr.subject,
  pr.next_follow_up_date,
  pr.sede_id,
  pr.departamento_id,
  pr.created_at,
  pr.updated_at
FROM public.portfolio_records pr
JOIN public.entities e ON e.id = pr.entity_id
WHERE pr.deleted_at IS NULL
  AND e.deleted_at IS NULL;

CREATE OR REPLACE VIEW api.v_import_progress AS
SELECT
  id,
  file_name,
  original_file_name,
  source_type,
  status,
  current_stage,
  progress_percent,
  progress_message,
  total_rows,
  processed_rows,
  valid_rows,
  invalid_rows,
  duplicate_rows,
  imported_rows,
  skipped_rows,
  started_at,
  completed_at,
  last_heartbeat_at,
  created_at
FROM public.import_batches
WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW api.v_verification_queue AS
SELECT
  id,
  entity_type,
  source,
  status,
  import_batch_id,
  staging_row_id,
  assigned_to_id,
  assigned_at,
  intake_session_id,
  display_name,
  search_cedula,
  search_ruc,
  political_division_code,
  created_at,
  updated_at
FROM public.verification_items
WHERE deleted_at IS NULL
  AND status IN ('PENDING', 'ASSIGNED', 'IN_REVIEW');

CREATE OR REPLACE VIEW api.v_event_registration AS
SELECT
  r.id,
  r.event_id,
  r.entity_id,
  r.status,
  r.registered_at,
  r.confirmed_at,
  r.attended_at,
  e.display_name AS entity_display_name,
  ev.name AS event_name
FROM public.event_registrations r
JOIN public.entities e ON e.id = r.entity_id
JOIN public.events ev ON ev.id = r.event_id
WHERE r.deleted_at IS NULL
  AND e.deleted_at IS NULL;

GRANT SELECT ON api.v_person_summary TO crm_api, crm_readonly_admin;
GRANT SELECT ON api.v_person_detail TO crm_api, crm_readonly_admin;
GRANT SELECT ON api.v_company_summary TO crm_api, crm_readonly_admin;
GRANT SELECT ON api.v_company_detail TO crm_api, crm_readonly_admin;
GRANT SELECT ON api.v_entity_contacts TO crm_api, crm_readonly_admin;
GRANT SELECT ON api.v_entity_location TO crm_api, crm_readonly_admin;
GRANT SELECT ON api.v_user_detail TO crm_api, crm_readonly_admin;
GRANT SELECT ON api.v_portfolio_summary TO crm_api, crm_readonly_admin;
GRANT SELECT ON api.v_import_progress TO crm_api, crm_readonly_admin;
GRANT SELECT ON api.v_verification_queue TO crm_api, crm_readonly_admin;
GRANT SELECT ON api.v_event_registration TO crm_api, crm_readonly_admin;

-- Lectura parametrizada
CREATE OR REPLACE FUNCTION api.fn_get_person(p_entity_id text)
RETURNS SETOF api.v_person_detail
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = api, public, pg_temp
AS $$
  SELECT * FROM api.v_person_detail WHERE entity_id = p_entity_id;
$$;

CREATE OR REPLACE FUNCTION api.fn_get_company(p_entity_id text)
RETURNS SETOF api.v_company_detail
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = api, public, pg_temp
AS $$
  SELECT * FROM api.v_company_detail WHERE entity_id = p_entity_id;
$$;

CREATE OR REPLACE FUNCTION api.fn_search_people(
  p_q text DEFAULT NULL,
  p_document text DEFAULT NULL,
  p_province_code text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS SETOF api.v_person_summary
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = api, public, pg_temp
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(coalesce(p_limit, 50), 1), 100);
  v_offset int := GREATEST(coalesce(p_offset, 0), 0);
  v_doc text := api.fn_normalize_document(p_document);
BEGIN
  RETURN QUERY
  SELECT s.*
  FROM api.v_person_summary s
  WHERE (p_q IS NULL OR s.display_name ILIKE '%' || p_q || '%'
         OR s.first_name ILIKE '%' || p_q || '%'
         OR s.last_name ILIKE '%' || p_q || '%')
    AND (v_doc IS NULL OR s.document_number_normalized = v_doc
         OR s.document_number ILIKE '%' || p_document || '%')
    AND (p_province_code IS NULL OR s.province_code = p_province_code)
  ORDER BY s.created_at DESC
  LIMIT v_limit OFFSET v_offset;
END;
$$;

CREATE OR REPLACE FUNCTION api.fn_get_import_progress(p_batch_id text)
RETURNS SETOF api.v_import_progress
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = api, pg_temp
AS $$
  SELECT * FROM api.v_import_progress WHERE id = p_batch_id;
$$;

CREATE OR REPLACE FUNCTION api.fn_get_verification_queue(
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS SETOF api.v_verification_queue
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = api, pg_temp
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(coalesce(p_limit, 50), 1), 100);
BEGIN
  RETURN QUERY
  SELECT * FROM api.v_verification_queue
  ORDER BY created_at ASC
  LIMIT v_limit OFFSET GREATEST(coalesce(p_offset, 0), 0);
END;
$$;

REVOKE ALL ON FUNCTION api.fn_get_person(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION api.fn_get_company(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION api.fn_search_people(text, text, text, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION api.fn_get_import_progress(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION api.fn_get_verification_queue(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.fn_get_person(text) TO crm_api, crm_readonly_admin;
GRANT EXECUTE ON FUNCTION api.fn_get_company(text) TO crm_api, crm_readonly_admin;
GRANT EXECUTE ON FUNCTION api.fn_search_people(text, text, text, int, int) TO crm_api, crm_readonly_admin;
GRANT EXECUTE ON FUNCTION api.fn_get_import_progress(text) TO crm_api, crm_readonly_admin;
GRANT EXECUTE ON FUNCTION api.fn_get_verification_queue(int, int) TO crm_api, crm_readonly_admin;

-- Escritura: crear persona
CREATE OR REPLACE PROCEDURE api.sp_create_person(
  p_actor_id text,
  p_first_name text,
  p_last_name text,
  p_second_last_name text DEFAULT NULL,
  p_document_type text DEFAULT NULL,
  p_document_number text DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_political_division_code text DEFAULT NULL,
  p_address_line text DEFAULT NULL,
  p_source_origin text DEFAULT 'MANUAL',
  INOUT p_entity_id text DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, catalog, api, audit, pg_temp
AS $$
DECLARE
  v_id text := gen_random_uuid()::text;
  v_display text;
  v_norm text;
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_actor_id, ''), true);

  IF p_political_division_code IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM catalog.political_divisions d WHERE d.code = p_political_division_code AND d.is_active
  ) THEN
    RAISE EXCEPTION 'Código de división política inválido: %', p_political_division_code
      USING ERRCODE = '23503';
  END IF;

  v_norm := api.fn_normalize_document(p_document_number);
  IF v_norm IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.persons p
    WHERE p.document_number_normalized = v_norm AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Documento ya registrado'
      USING ERRCODE = '23505';
  END IF;

  v_display := btrim(concat_ws(' ', p_first_name, p_last_name, p_second_last_name));

  INSERT INTO public.entities (
    id, entity_type, status, display_name,
    political_division_code, address_line, address,
    source_origin, created_by_id, created_at, updated_at
  ) VALUES (
    v_id, 'PERSON', 'ACTIVE', v_display,
    p_political_division_code, p_address_line, p_address_line,
    p_source_origin, p_actor_id, NOW(), NOW()
  );

  INSERT INTO public.persons (
    id, entity_id, document_type, document_number, document_number_normalized,
    cedula, first_name, last_name, second_last_name, gender, nationality_code
  ) VALUES (
    gen_random_uuid()::text, v_id,
    p_document_type::"DocumentType", p_document_number, v_norm,
    p_document_number, p_first_name, p_last_name, p_second_last_name,
    p_gender::"Gender", 'PAN'
  );

  p_entity_id := v_id;
END;
$$;

CREATE OR REPLACE PROCEDURE api.sp_update_person(
  p_actor_id text,
  p_entity_id text,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_second_last_name text DEFAULT NULL,
  p_document_type text DEFAULT NULL,
  p_document_number text DEFAULT NULL,
  p_political_division_code text DEFAULT NULL,
  p_address_line text DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, catalog, api, audit, pg_temp
AS $$
DECLARE
  v_norm text;
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_actor_id, ''), true);

  IF NOT EXISTS (
    SELECT 1 FROM public.entities e
    WHERE e.id = p_entity_id AND e.entity_type = 'PERSON' AND e.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Persona no encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF p_political_division_code IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM catalog.political_divisions d WHERE d.code = p_political_division_code AND d.is_active
  ) THEN
    RAISE EXCEPTION 'Código de división política inválido' USING ERRCODE = '23503';
  END IF;

  UPDATE public.entities SET
    political_division_code = COALESCE(p_political_division_code, political_division_code),
    address_line = COALESCE(p_address_line, address_line),
    address = COALESCE(p_address_line, address),
    updated_at = NOW()
  WHERE id = p_entity_id;

  v_norm := CASE WHEN p_document_number IS NOT NULL THEN api.fn_normalize_document(p_document_number) ELSE NULL END;

  UPDATE public.persons SET
    first_name = COALESCE(p_first_name, first_name),
    last_name = COALESCE(p_last_name, last_name),
    second_last_name = COALESCE(p_second_last_name, second_last_name),
    document_type = COALESCE(p_document_type::"DocumentType", document_type),
    document_number = COALESCE(p_document_number, document_number),
    document_number_normalized = COALESCE(v_norm, document_number_normalized),
    cedula = COALESCE(p_document_number, cedula)
  WHERE entity_id = p_entity_id AND deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE PROCEDURE api.sp_soft_delete_person(
  p_actor_id text,
  p_entity_id text,
  p_reason text DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_actor_id, ''), true);

  UPDATE public.persons
  SET deleted_at = NOW(), deleted_by_id = p_actor_id
  WHERE entity_id = p_entity_id AND deleted_at IS NULL;

  UPDATE public.entities
  SET deleted_at = NOW(), deleted_by_id = p_actor_id, delete_reason = p_reason,
      status = 'INACTIVE', updated_at = NOW()
  WHERE id = p_entity_id AND deleted_at IS NULL AND entity_type = 'PERSON';
END;
$$;

CREATE OR REPLACE PROCEDURE api.sp_restore_person(
  p_actor_id text,
  p_entity_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_actor_id, ''), true);

  UPDATE public.persons
  SET deleted_at = NULL, deleted_by_id = NULL
  WHERE entity_id = p_entity_id AND deleted_at IS NOT NULL;

  UPDATE public.entities
  SET deleted_at = NULL, deleted_by_id = NULL, delete_reason = NULL,
      restored_at = NOW(), restored_by_id = p_actor_id,
      status = 'ACTIVE', updated_at = NOW()
  WHERE id = p_entity_id AND entity_type = 'PERSON';
END;
$$;

CREATE OR REPLACE PROCEDURE api.sp_create_company(
  p_actor_id text,
  p_legal_name text,
  p_trade_name text DEFAULT NULL,
  p_ruc text DEFAULT NULL,
  p_dv text DEFAULT NULL,
  p_political_division_code text DEFAULT NULL,
  p_address_line text DEFAULT NULL,
  p_source_origin text DEFAULT 'MANUAL',
  INOUT p_entity_id text DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, catalog, api, audit, pg_temp
AS $$
DECLARE
  v_id text := gen_random_uuid()::text;
  v_norm text;
  v_display text;
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_actor_id, ''), true);
  v_norm := api.fn_normalize_document(p_ruc);
  v_display := COALESCE(NULLIF(btrim(p_trade_name), ''), p_legal_name);

  IF v_norm IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.companies c WHERE c.ruc_normalized = v_norm AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'RUC ya registrado' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.entities (
    id, entity_type, status, display_name,
    political_division_code, address_line, address,
    source_origin, created_by_id, created_at, updated_at
  ) VALUES (
    v_id, 'COMPANY', 'ACTIVE', v_display,
    p_political_division_code, p_address_line, p_address_line,
    p_source_origin, p_actor_id, NOW(), NOW()
  );

  INSERT INTO public.companies (
    id, entity_id, ruc, dv, ruc_normalized, legal_name, trade_name
  ) VALUES (
    gen_random_uuid()::text, v_id, p_ruc, p_dv, v_norm, p_legal_name, p_trade_name
  );

  p_entity_id := v_id;
END;
$$;

CREATE OR REPLACE PROCEDURE api.sp_soft_delete_company(
  p_actor_id text,
  p_entity_id text,
  p_reason text DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_actor_id, ''), true);
  UPDATE public.companies SET deleted_at = NOW(), deleted_by_id = p_actor_id
  WHERE entity_id = p_entity_id AND deleted_at IS NULL;
  UPDATE public.entities
  SET deleted_at = NOW(), deleted_by_id = p_actor_id, delete_reason = p_reason,
      status = 'INACTIVE', updated_at = NOW()
  WHERE id = p_entity_id AND deleted_at IS NULL AND entity_type = 'COMPANY';
END;
$$;

CREATE OR REPLACE PROCEDURE api.sp_add_contact(
  p_actor_id text,
  p_entity_id text,
  p_contact_type text,
  p_contact_value text,
  p_label text DEFAULT NULL,
  p_is_primary boolean DEFAULT false,
  INOUT p_contact_id text DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
DECLARE
  v_norm text;
  v_id text := gen_random_uuid()::text;
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_actor_id, ''), true);

  IF NOT EXISTS (SELECT 1 FROM public.entities WHERE id = p_entity_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Entidad no encontrada' USING ERRCODE = 'P0002';
  END IF;

  v_norm := CASE
    WHEN p_contact_type IN ('PHONE', 'MOBILE', 'WHATSAPP') THEN regexp_replace(p_contact_value, '[^0-9]', '', 'g')
    WHEN p_contact_type = 'EMAIL' THEN lower(btrim(p_contact_value))
    ELSE upper(btrim(p_contact_value))
  END;

  IF p_is_primary THEN
    UPDATE public.entity_contacts SET is_primary = FALSE
    WHERE entity_id = p_entity_id AND contact_type = p_contact_type::"ContactType" AND deleted_at IS NULL;
  END IF;

  INSERT INTO public.entity_contacts (
    id, entity_id, contact_type, contact_value, normalized_value, label, is_primary, created_at, updated_at
  ) VALUES (
    v_id, p_entity_id, p_contact_type::"ContactType", p_contact_value, v_norm, p_label, p_is_primary, NOW(), NOW()
  );

  p_contact_id := v_id;
END;
$$;

CREATE OR REPLACE PROCEDURE api.sp_soft_delete_contact(
  p_actor_id text,
  p_contact_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_actor_id, ''), true);
  UPDATE public.entity_contacts
  SET deleted_at = NOW(), deleted_by_id = p_actor_id, updated_at = NOW()
  WHERE id = p_contact_id AND deleted_at IS NULL;
END;
$$;

-- Grants procedures
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

-- SECURITY DEFINER owners need table rights: migrator/current user owns them.
-- Grant crm_api NO table rights on public/core:
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM crm_api;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM crm_api;
REVOKE ALL ON ALL TABLES IN SCHEMA catalog FROM crm_api;
REVOKE ALL ON ALL TABLES IN SCHEMA audit FROM crm_api;
REVOKE ALL ON ALL TABLES IN SCHEMA security FROM crm_api;
REVOKE ALL ON ALL TABLES IN SCHEMA integration FROM crm_api;
REVOKE ALL ON SCHEMA public FROM crm_api;
REVOKE ALL ON SCHEMA catalog FROM crm_api;
REVOKE ALL ON SCHEMA audit FROM crm_api;
REVOKE ALL ON SCHEMA security FROM crm_api;
REVOKE ALL ON SCHEMA core FROM crm_api;
REVOKE ALL ON SCHEMA crm FROM crm_api;
REVOKE ALL ON SCHEMA events FROM crm_api;
REVOKE ALL ON SCHEMA imports FROM crm_api;
REVOKE ALL ON SCHEMA verification FROM crm_api;
REVOKE ALL ON SCHEMA intake FROM crm_api;
REVOKE ALL ON SCHEMA integration FROM crm_api;
REVOKE ALL ON SCHEMA workflow FROM crm_api;

GRANT USAGE ON SCHEMA api TO crm_api;
GRANT SELECT ON ALL TABLES IN SCHEMA api TO crm_api;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA api TO crm_api;

ALTER DEFAULT PRIVILEGES IN SCHEMA api
  GRANT SELECT ON TABLES TO crm_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA api
  GRANT EXECUTE ON FUNCTIONS TO crm_api;

-- Actualizar fn_validar para usar document_number_normalized / political soft-delete
CREATE OR REPLACE FUNCTION public.fn_validar_registro_empresarial(p_documento text)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fecha date;
  v_status text;
  v_doc text;
BEGIN
  IF p_documento IS NULL OR btrim(p_documento) = '' THEN
    RETURN 0;
  END IF;
  v_doc := upper(regexp_replace(btrim(p_documento), '[^0-9A-Z]', '', 'g'));

  SELECT e.registro_empresarial_fecha, e.status::text
    INTO v_fecha, v_status
    FROM entities e
   WHERE e.deleted_at IS NULL
     AND e.id IN (
           SELECT c.entity_id FROM companies c
            WHERE c.deleted_at IS NULL
              AND (c.ruc_normalized = v_doc OR upper(regexp_replace(coalesce(c.ruc,''), '[^0-9A-Z]', '', 'g')) = v_doc)
           UNION ALL
           SELECT p.entity_id FROM persons p
            WHERE p.deleted_at IS NULL
              AND (p.document_number_normalized = v_doc
                   OR upper(regexp_replace(coalesce(p.document_number, p.cedula, ''), '[^0-9A-Z]', '', 'g')) = v_doc)
         )
   ORDER BY e.registro_empresarial_fecha DESC NULLS LAST
   LIMIT 1;

  IF NOT FOUND OR v_fecha IS NULL THEN RETURN 0; END IF;
  IF v_status IS DISTINCT FROM 'ACTIVE' THEN RETURN 0; END IF;
  IF (CURRENT_DATE - v_fecha) > 365 THEN RETURN 1; END IF;
  RETURN 2;
END;
$$;
