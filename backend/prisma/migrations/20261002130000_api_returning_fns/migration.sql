-- Functions de escritura que retornan id (Prisma no captura INOUT de CALL fácilmente)

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

CREATE OR REPLACE FUNCTION api.fn_add_contact(
  p_actor_id text,
  p_entity_id text,
  p_contact_type text,
  p_contact_value text,
  p_label text DEFAULT NULL,
  p_is_primary boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
DECLARE
  v_id text;
BEGIN
  CALL api.sp_add_contact(
    p_actor_id, p_entity_id, p_contact_type, p_contact_value,
    p_label, p_is_primary, v_id
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE VIEW api.v_entity_relationships AS
SELECT
  id,
  from_entity_id,
  to_entity_id,
  relationship_type,
  role,
  start_date,
  end_date,
  is_active,
  created_at,
  updated_at
FROM public.entity_relationships
WHERE deleted_at IS NULL AND is_active = TRUE;

GRANT SELECT ON api.v_entity_relationships TO crm_api, crm_readonly_admin;

