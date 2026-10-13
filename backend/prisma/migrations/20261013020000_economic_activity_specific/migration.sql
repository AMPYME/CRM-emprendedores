-- Actividad específica (texto libre, máx. 25) en actividades económicas CINU.

ALTER TABLE public.entity_economic_activities
  ADD COLUMN IF NOT EXISTS specific_activity VARCHAR(25);

COMMENT ON COLUMN public.entity_economic_activities.specific_activity IS
  'Actividad específica descrita por el usuario (máximo 25 caracteres)';

ALTER TABLE public.entity_economic_activities
  DROP CONSTRAINT IF EXISTS entity_economic_activities_specific_activity_chk;

ALTER TABLE public.entity_economic_activities
  ADD CONSTRAINT entity_economic_activities_specific_activity_chk
  CHECK (
    specific_activity IS NULL
    OR char_length(btrim(specific_activity)) BETWEEN 1 AND 25
  );

-- Cambiar firma / columnas de retorno requiere DROP + CREATE.
DROP FUNCTION IF EXISTS api.fn_map_economic_activity(text);
DROP FUNCTION IF EXISTS api.fn_get_entity_economic_activities(text);
DROP FUNCTION IF EXISTS api.fn_assign_entity_economic_activity(text, text, text, boolean, text);
DROP FUNCTION IF EXISTS api.fn_set_primary_economic_activity(text, text, text);
DROP FUNCTION IF EXISTS api.fn_remove_entity_economic_activity(text, text, text);
DROP FUNCTION IF EXISTS api.fn_activity_audit_payload(text);

CREATE OR REPLACE FUNCTION api.fn_map_economic_activity(p_activity_id text)
RETURNS TABLE (
  id text,
  entity_id text,
  cinu_class_id text,
  cinu_subclass_id text,
  is_primary boolean,
  specific_activity varchar,
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    a.id,
    a.entity_id,
    a.cinu_class_id,
    a.cinu_subclass_id,
    a.is_primary,
    a.specific_activity,
    c.code,
    c.name,
    s.code,
    s.name,
    g.code,
    g.name,
    d.code,
    d.name,
    cat.code,
    cat.name,
    v.code,
    a.created_at,
    a.updated_at,
    a.deleted_at
  FROM public.entity_economic_activities a
  JOIN public.cinu_classes c ON c.id = a.cinu_class_id
  JOIN public.cinu_groups g ON g.id = c.group_id
  JOIN public.cinu_divisions d ON d.id = g.division_id
  JOIN public.cinu_categories cat ON cat.id = d.category_id
  JOIN public.cinu_versions v ON v.id = c.version_id
  LEFT JOIN public.cinu_subclasses s ON s.id = a.cinu_subclass_id
  WHERE a.id = p_activity_id;
$$;

CREATE OR REPLACE FUNCTION api.fn_get_entity_economic_activities(p_entity_id text)
RETURNS TABLE (
  id text,
  entity_id text,
  cinu_class_id text,
  cinu_subclass_id text,
  is_primary boolean,
  specific_activity varchar,
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
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_entity_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.entities e WHERE e.id = p_entity_id AND e.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Entidad no encontrada' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT m.*
    FROM public.entity_economic_activities a
    JOIN LATERAL api.fn_map_economic_activity(a.id) m ON TRUE
   WHERE a.entity_id = p_entity_id
     AND a.deleted_at IS NULL
   ORDER BY a.is_primary DESC, m.class_code, m.subclass_code NULLS FIRST;
END;
$$;

CREATE OR REPLACE FUNCTION api.fn_activity_audit_payload(p_activity_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'codigo', m.class_code,
    'nombre', m.class_name,
    'subclase', m.subclass_code,
    'actividadEspecifica', m.specific_activity,
    'principal', m.is_primary
  )
  FROM api.fn_map_economic_activity(p_activity_id) m;
$$;

CREATE OR REPLACE FUNCTION api.fn_assign_entity_economic_activity(
  p_entity_id text,
  p_class_id text,
  p_subclass_id text,
  p_is_primary boolean,
  p_actor_id text,
  p_specific_activity text DEFAULT NULL
) RETURNS TABLE (
  id text,
  entity_id text,
  cinu_class_id text,
  cinu_subclass_id text,
  is_primary boolean,
  specific_activity varchar,
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
  v_id text;
  v_subclass text := NULLIF(btrim(coalesce(p_subclass_id, '')), '');
  v_primary boolean := coalesce(p_is_primary, false);
  v_actor text := NULLIF(btrim(coalesce(p_actor_id, '')), '');
  v_specific text := NULLIF(btrim(coalesce(p_specific_activity, '')), '');
  v_label text;
BEGIN
  IF p_entity_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.entities e WHERE e.id = p_entity_id AND e.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Entidad no encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF p_class_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.cinu_classes c WHERE c.id = p_class_id) THEN
    RAISE EXCEPTION 'Clase económica inexistente' USING ERRCODE = '23503';
  END IF;
  IF v_specific IS NOT NULL AND char_length(v_specific) > 25 THEN
    RAISE EXCEPTION 'La actividad específica no puede superar 25 caracteres' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.entity_economic_activities a
     WHERE a.entity_id = p_entity_id
       AND a.cinu_class_id = p_class_id
       AND a.cinu_subclass_id IS NOT DISTINCT FROM v_subclass
       AND a.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'La entidad ya tiene esa actividad económica activa' USING ERRCODE = '23505';
  END IF;

  IF v_primary THEN
    UPDATE public.entity_economic_activities
       SET is_primary = false,
           updated_at = CURRENT_TIMESTAMP,
           updated_by_id = v_actor
     WHERE entity_id = p_entity_id
       AND deleted_at IS NULL
       AND is_primary;
  END IF;

  SELECT a.id INTO v_id
    FROM public.entity_economic_activities a
   WHERE a.entity_id = p_entity_id
     AND a.cinu_class_id = p_class_id
     AND a.cinu_subclass_id IS NOT DISTINCT FROM v_subclass
     AND a.deleted_at IS NOT NULL
   ORDER BY a.deleted_at DESC
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.entity_economic_activities
       SET deleted_at = NULL,
           deleted_by_id = NULL,
           is_primary = v_primary,
           specific_activity = left(v_specific, 25),
           updated_at = CURRENT_TIMESTAMP,
           updated_by_id = v_actor
     WHERE id = v_id;
  ELSE
    v_id := gen_random_uuid()::text;
    INSERT INTO public.entity_economic_activities (
      id, entity_id, cinu_class_id, cinu_subclass_id, is_primary, specific_activity,
      created_at, updated_at, created_by_id, updated_by_id
    ) VALUES (
      v_id, p_entity_id, p_class_id, v_subclass, v_primary, left(v_specific, 25),
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, v_actor, v_actor
    );
  END IF;

  SELECT m.class_code || ' ' || m.class_name INTO v_label
    FROM api.fn_map_economic_activity(v_id) m;

  PERFORM api.fn_log_economic_activity(
    'CREATE', p_entity_id, v_id, v_actor, v_label, NULL,
    api.fn_activity_audit_payload(v_id)
  );

  RETURN QUERY SELECT * FROM api.fn_map_economic_activity(v_id);
EXCEPTION
  WHEN unique_violation THEN
    IF SQLERRM ILIKE '%one_primary%' THEN
      RAISE EXCEPTION 'Solo puede existir una actividad principal activa por entidad' USING ERRCODE = '23505';
    END IF;
    RAISE EXCEPTION 'La entidad ya tiene esa actividad económica activa' USING ERRCODE = '23505';
END;
$$;

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

  UPDATE public.entity_economic_activities
     SET is_primary = (id = p_activity_id),
         updated_at = CURRENT_TIMESTAMP,
         updated_by_id = v_actor
   WHERE entity_id = p_entity_id
     AND deleted_at IS NULL
     AND (is_primary OR id = p_activity_id);

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

CREATE OR REPLACE FUNCTION api.fn_remove_entity_economic_activity(
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
  SELECT m.class_code || ' ' || m.class_name INTO v_label
    FROM api.fn_map_economic_activity(p_activity_id) m;

  UPDATE public.entity_economic_activities
     SET deleted_at = CURRENT_TIMESTAMP,
         deleted_by_id = v_actor,
         is_primary = false,
         updated_at = CURRENT_TIMESTAMP,
         updated_by_id = v_actor
   WHERE id = p_activity_id
     AND entity_id = p_entity_id
     AND deleted_at IS NULL;

  PERFORM api.fn_log_economic_activity(
    'DELETE', p_entity_id, p_activity_id, v_actor, v_label, v_before,
    api.fn_activity_audit_payload(p_activity_id)
  );

  RETURN QUERY SELECT * FROM api.fn_map_economic_activity(p_activity_id);
END;
$$;

REVOKE ALL ON FUNCTION
  api.fn_map_economic_activity(text),
  api.fn_get_entity_economic_activities(text),
  api.fn_activity_audit_payload(text),
  api.fn_assign_entity_economic_activity(text, text, text, boolean, text, text),
  api.fn_set_primary_economic_activity(text, text, text),
  api.fn_remove_entity_economic_activity(text, text, text)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  api.fn_get_entity_economic_activities(text)
TO crm_api, crm_readonly_admin;

GRANT EXECUTE ON FUNCTION
  api.fn_assign_entity_economic_activity(text, text, text, boolean, text, text),
  api.fn_set_primary_economic_activity(text, text, text),
  api.fn_remove_entity_economic_activity(text, text, text)
TO crm_api;

REVOKE ALL ON FUNCTION
  api.fn_map_economic_activity(text),
  api.fn_activity_audit_payload(text)
FROM crm_api, crm_readonly_admin;
