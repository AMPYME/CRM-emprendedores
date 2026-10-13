-- Corrige ambigüedad de columnas en fn_set_primary_economic_activity
-- (RETURNS TABLE crea variables PL/pgSQL que chocan con nombres de columna).

CREATE OR REPLACE FUNCTION api.fn_set_primary_economic_activity(
  p_entity_id text,
  p_activity_id text,
  p_actor_id text
) RETURNS TABLE (
  id text,
  entity_id text,
  cinu_class_id text,
  cinu_subclass_id text,
  is_primary boolean,
  specific_activity varchar,
  has_notice_of_operation boolean,
  class_code varchar,
  class_name varchar,
  subclass_code varchar,
  subclass_name varchar,
  group_code varchar,
  group_name varchar,
  division_code varchar,
  division_name varchar,
  category_code varchar,
  category_name varchar,
  version_code varchar,
  created_at timestamp,
  updated_at timestamp,
  deleted_at timestamp
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor text := NULLIF(btrim(coalesce(p_actor_id, '')), '');
  v_before jsonb;
  v_label text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.entity_economic_activities a
     WHERE a.id = p_activity_id
       AND a.entity_id = p_entity_id
       AND a.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Actividad económica no encontrada' USING ERRCODE = 'P0002';
  END IF;

  v_before := api.fn_activity_audit_payload(p_activity_id);

  -- Dos pasos para no violar el índice único parcial de una sola principal.
  UPDATE public.entity_economic_activities AS a
     SET is_primary = false,
         updated_at = CURRENT_TIMESTAMP,
         updated_by_id = v_actor
   WHERE a.entity_id = p_entity_id
     AND a.deleted_at IS NULL
     AND a.is_primary
     AND a.id <> p_activity_id;

  UPDATE public.entity_economic_activities AS a
     SET is_primary = true,
         updated_at = CURRENT_TIMESTAMP,
         updated_by_id = v_actor
   WHERE a.id = p_activity_id
     AND a.entity_id = p_entity_id
     AND a.deleted_at IS NULL;

  SELECT m.class_code || ' ' || m.class_name INTO v_label
    FROM api.fn_map_economic_activity(p_activity_id) m;

  PERFORM api.fn_log_economic_activity(
    'UPDATE', p_entity_id, p_activity_id, v_actor, v_label, v_before,
    api.fn_activity_audit_payload(p_activity_id)
  );

  RETURN QUERY SELECT * FROM api.fn_map_economic_activity(p_activity_id);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Solo puede existir una actividad principal activa por entidad' USING ERRCODE = '23505';
END;
$$;

REVOKE ALL ON FUNCTION api.fn_set_primary_economic_activity(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.fn_set_primary_economic_activity(text, text, text) TO crm_api;
