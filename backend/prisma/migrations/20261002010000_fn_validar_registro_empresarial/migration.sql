-- Consulta pública de vigencia del registro empresarial (RUC o cédula).
-- Códigos de retorno (compatibles con MySQL fn_validar_registro_empresarial):
--   0 = no encontrado / sin fecha / entidad no activa
--   1 = expirado (> 365 días desde registro_empresarial_fecha)
--   2 = válido
--
-- El rol rempresarial_viewer solo puede EXECUTE esta función (SECURITY DEFINER).
-- Cambiar la contraseña en cada entorno:
--   ALTER ROLE rempresarial_viewer PASSWORD 'secreto-seguro';

CREATE OR REPLACE FUNCTION public.fn_validar_registro_empresarial(p_documento text)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fecha date;
  v_status text;
  v_doc text;
BEGIN
  IF p_documento IS NULL OR btrim(p_documento) = '' THEN
    RETURN 0;
  END IF;

  v_doc := upper(btrim(p_documento));

  SELECT e.registro_empresarial_fecha, e.status::text
    INTO v_fecha, v_status
    FROM entities e
   WHERE e.id IN (
           SELECT c.entity_id
             FROM companies c
            WHERE upper(btrim(coalesce(c.ruc, ''))) = v_doc
           UNION ALL
           SELECT p.entity_id
             FROM persons p
            WHERE upper(btrim(coalesce(p.document_number, ''))) = v_doc
               OR upper(btrim(coalesce(p.cedula, ''))) = v_doc
         )
   ORDER BY e.registro_empresarial_fecha DESC NULLS LAST
   LIMIT 1;

  IF NOT FOUND OR v_fecha IS NULL THEN
    RETURN 0;
  END IF;

  -- Equivalente a is_deleted = 1 en MySQL
  IF v_status IS DISTINCT FROM 'ACTIVE' THEN
    RETURN 0;
  END IF;

  IF (CURRENT_DATE - v_fecha) > 365 THEN
    RETURN 1;
  END IF;

  RETURN 2;
END;
$$;

COMMENT ON FUNCTION public.fn_validar_registro_empresarial(text) IS
  'Valida vigencia de registro empresarial por RUC/cédula. Retorna 0|1|2.';

REVOKE ALL ON FUNCTION public.fn_validar_registro_empresarial(text) FROM PUBLIC;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rempresarial_viewer') THEN
    CREATE ROLE rempresarial_viewer LOGIN
      PASSWORD 'cambiar_rempresarial_viewer'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO rempresarial_viewer;
GRANT EXECUTE ON FUNCTION public.fn_validar_registro_empresarial(text) TO rempresarial_viewer;

-- Sin SELECT/INSERT/UPDATE/DELETE sobre tablas ni secuencias
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM rempresarial_viewer;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM rempresarial_viewer;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM rempresarial_viewer;
GRANT EXECUTE ON FUNCTION public.fn_validar_registro_empresarial(text) TO rempresarial_viewer;
