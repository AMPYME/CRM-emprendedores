-- Filtro de entidades por categoría / división CINU (solo vía api.*).

CREATE OR REPLACE FUNCTION api.fn_entity_ids_by_cinu_filter(
  p_category_id text DEFAULT NULL,
  p_division_id text DEFAULT NULL
)
RETURNS TABLE(entity_id text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_category_id IS NULL AND p_division_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT a.entity_id::text
  FROM public.entity_economic_activities a
  JOIN public.cinu_classes c
    ON c.id = a.cinu_class_id
  JOIN public.cinu_groups g
    ON g.id = c.group_id
   AND g.version_id = c.version_id
  JOIN public.cinu_divisions d
    ON d.id = g.division_id
   AND d.version_id = g.version_id
  WHERE a.deleted_at IS NULL
    AND (
      p_division_id IS NULL
      OR d.id = p_division_id
    )
    AND (
      p_category_id IS NULL
      OR d.category_id = p_category_id
    );
END;
$$;

REVOKE ALL ON FUNCTION api.fn_entity_ids_by_cinu_filter(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.fn_entity_ids_by_cinu_filter(text, text)
  TO crm_api, crm_readonly_admin;
