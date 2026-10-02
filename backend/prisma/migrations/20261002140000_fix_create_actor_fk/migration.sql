-- Fix: created_by_id solo si el usuario existe (evita 23503 con 'system' u actor inválido)

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
  v_created_by text;
  v_geo text;
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_actor_id, ''), true);

  v_created_by := CASE
    WHEN p_actor_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_actor_id AND u.deleted_at IS NULL)
    THEN p_actor_id
    ELSE NULL
  END;

  v_geo := NULLIF(btrim(p_political_division_code), '');
  IF v_geo IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM catalog.political_divisions d WHERE d.code = v_geo AND d.is_active
  ) THEN
    -- No abortar el alta por geo inválida: persistir sin código
    v_geo := NULL;
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
    v_geo, p_address_line, p_address_line,
    COALESCE(NULLIF(btrim(p_source_origin), ''), 'MANUAL'), v_created_by, NOW(), NOW()
  );

  INSERT INTO public.persons (
    id, entity_id, document_type, document_number, document_number_normalized,
    cedula, first_name, last_name, second_last_name, gender, nationality_code
  ) VALUES (
    gen_random_uuid()::text, v_id,
    CASE WHEN p_document_type IS NULL OR btrim(p_document_type) = '' THEN NULL
         ELSE p_document_type::"DocumentType" END,
    p_document_number, v_norm,
    p_document_number, p_first_name, p_last_name, p_second_last_name,
    CASE WHEN p_gender IS NULL OR btrim(p_gender) = '' THEN NULL
         ELSE p_gender::"Gender" END,
    'PAN'
  );

  p_entity_id := v_id;
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
  v_created_by text;
  v_geo text;
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_actor_id, ''), true);

  v_created_by := CASE
    WHEN p_actor_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_actor_id AND u.deleted_at IS NULL)
    THEN p_actor_id
    ELSE NULL
  END;

  v_geo := NULLIF(btrim(p_political_division_code), '');
  IF v_geo IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM catalog.political_divisions d WHERE d.code = v_geo AND d.is_active
  ) THEN
    v_geo := NULL;
  END IF;

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
    v_geo, p_address_line, p_address_line,
    COALESCE(NULLIF(btrim(p_source_origin), ''), 'MANUAL'), v_created_by, NOW(), NOW()
  );

  INSERT INTO public.companies (
    id, entity_id, ruc, dv, ruc_normalized, legal_name, trade_name
  ) VALUES (
    gen_random_uuid()::text, v_id, p_ruc, p_dv, v_norm, p_legal_name, p_trade_name
  );

  p_entity_id := v_id;
END;
$$;

-- Recrear wrappers (siguen llamando a los procedures)
CREATE OR REPLACE FUNCTION api.fn_create_person(
  p_actor_id text,
  p_first_name text,
  p_last_name text,
  p_second_last_name text DEFAULT NULL,
  p_document_type text DEFAULT NULL,
  p_document_number text DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_political_division_code text DEFAULT NULL,
  p_address_line text DEFAULT NULL,
  p_source_origin text DEFAULT 'MANUAL'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, catalog, api, audit, pg_temp
AS $$
DECLARE
  v_id text;
BEGIN
  CALL api.sp_create_person(
    p_actor_id, p_first_name, p_last_name, p_second_last_name,
    p_document_type, p_document_number, p_gender,
    p_political_division_code, p_address_line, p_source_origin, v_id
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION api.fn_create_company(
  p_actor_id text,
  p_legal_name text,
  p_trade_name text DEFAULT NULL,
  p_ruc text DEFAULT NULL,
  p_dv text DEFAULT NULL,
  p_political_division_code text DEFAULT NULL,
  p_address_line text DEFAULT NULL,
  p_source_origin text DEFAULT 'MANUAL'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, catalog, api, audit, pg_temp
AS $$
DECLARE
  v_id text;
BEGIN
  CALL api.sp_create_company(
    p_actor_id, p_legal_name, p_trade_name, p_ruc, p_dv,
    p_political_division_code, p_address_line, p_source_origin, v_id
  );
  RETURN v_id;
END;
$$;

REVOKE ALL ON PROCEDURE api.sp_create_person(text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON PROCEDURE api.sp_create_company(text, text, text, text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION api.fn_create_person(text, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION api.fn_create_company(text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON PROCEDURE api.sp_create_person(text, text, text, text, text, text, text, text, text, text, text) TO crm_api;
GRANT EXECUTE ON PROCEDURE api.sp_create_company(text, text, text, text, text, text, text, text, text) TO crm_api;
GRANT EXECUTE ON FUNCTION api.fn_create_person(text, text, text, text, text, text, text, text, text, text) TO crm_api;
GRANT EXECUTE ON FUNCTION api.fn_create_company(text, text, text, text, text, text, text, text) TO crm_api;
