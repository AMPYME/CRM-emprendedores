-- CINU 4.1 y actividades económicas por entidad.
-- La API solo ejecuta funciones de api.*. crm_api no tiene DML sobre estas tablas.
-- Idempotente: tolera reintentos y un stub legacy vacío (activity_id → catalog).

ALTER TABLE public.persons
  ADD COLUMN IF NOT EXISTS has_notice_of_operation BOOLEAN;

COMMENT ON COLUMN public.persons.has_notice_of_operation IS
  'Aviso de operación: true = Sí, false = No, null = sin dato';

-- Stub previo (schema distinto: activity_id → catalog.economic_activities).
-- Si está vacío se elimina; si tiene filas se preserva con otro nombre.
DO $$
BEGIN
  IF to_regclass('public.entity_economic_activities') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'entity_economic_activities'
         AND column_name = 'activity_id'
     )
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'entity_economic_activities'
         AND column_name = 'cinu_class_id'
     )
  THEN
    IF (SELECT count(*) FROM public.entity_economic_activities) = 0 THEN
      DROP TABLE public.entity_economic_activities;
    ELSE
      ALTER TABLE public.entity_economic_activities
        RENAME TO entity_economic_activities_pre_cinu;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Catálogo versionado. Códigos VARCHAR para conservar ceros iniciales.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cinu_versions (
  id         TEXT PRIMARY KEY,
  code       VARCHAR(32) NOT NULL,
  name       VARCHAR(200) NOT NULL,
  source     VARCHAR(400),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cinu_versions_code_chk CHECK (char_length(btrim(code)) > 0),
  CONSTRAINT cinu_versions_name_chk CHECK (char_length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS cinu_versions_code_key ON public.cinu_versions (code);
CREATE UNIQUE INDEX IF NOT EXISTS cinu_versions_one_active_uidx
  ON public.cinu_versions ((1))
  WHERE is_active;

CREATE TABLE IF NOT EXISTS public.cinu_categories (
  id         TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES public.cinu_versions (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  code       VARCHAR(16) NOT NULL,
  name       VARCHAR(300) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cinu_categories_code_chk CHECK (code ~ '^[A-Z]$'),
  CONSTRAINT cinu_categories_name_chk CHECK (char_length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS cinu_categories_id_version_key ON public.cinu_categories (id, version_id);
CREATE UNIQUE INDEX IF NOT EXISTS cinu_categories_version_code_key ON public.cinu_categories (version_id, code);
CREATE INDEX IF NOT EXISTS cinu_categories_version_id_idx ON public.cinu_categories (version_id);

CREATE TABLE IF NOT EXISTS public.cinu_divisions (
  id          TEXT PRIMARY KEY,
  version_id  TEXT NOT NULL,
  category_id TEXT NOT NULL,
  code        VARCHAR(16) NOT NULL,
  name        VARCHAR(300) NOT NULL,
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cinu_divisions_category_version_fkey
    FOREIGN KEY (category_id, version_id)
    REFERENCES public.cinu_categories (id, version_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT cinu_divisions_code_chk CHECK (code ~ '^[0-9]{2}$'),
  CONSTRAINT cinu_divisions_name_chk CHECK (char_length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS cinu_divisions_id_version_key ON public.cinu_divisions (id, version_id);
CREATE UNIQUE INDEX IF NOT EXISTS cinu_divisions_version_code_key ON public.cinu_divisions (version_id, code);
CREATE INDEX IF NOT EXISTS cinu_divisions_category_id_idx ON public.cinu_divisions (category_id);

CREATE TABLE IF NOT EXISTS public.cinu_groups (
  id          TEXT PRIMARY KEY,
  version_id  TEXT NOT NULL,
  division_id TEXT NOT NULL,
  code        VARCHAR(16) NOT NULL,
  name        VARCHAR(300) NOT NULL,
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cinu_groups_division_version_fkey
    FOREIGN KEY (division_id, version_id)
    REFERENCES public.cinu_divisions (id, version_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT cinu_groups_code_chk CHECK (code ~ '^[0-9]{3}$'),
  CONSTRAINT cinu_groups_name_chk CHECK (char_length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS cinu_groups_id_version_key ON public.cinu_groups (id, version_id);
CREATE UNIQUE INDEX IF NOT EXISTS cinu_groups_version_code_key ON public.cinu_groups (version_id, code);
CREATE INDEX IF NOT EXISTS cinu_groups_division_id_idx ON public.cinu_groups (division_id);

CREATE TABLE IF NOT EXISTS public.cinu_classes (
  id         TEXT PRIMARY KEY,
  version_id TEXT NOT NULL,
  group_id   TEXT NOT NULL,
  code       VARCHAR(16) NOT NULL,
  name       VARCHAR(300) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cinu_classes_group_version_fkey
    FOREIGN KEY (group_id, version_id)
    REFERENCES public.cinu_groups (id, version_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT cinu_classes_code_chk CHECK (code ~ '^[0-9]{4}$'),
  CONSTRAINT cinu_classes_name_chk CHECK (char_length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS cinu_classes_id_version_key ON public.cinu_classes (id, version_id);
CREATE UNIQUE INDEX IF NOT EXISTS cinu_classes_version_code_key ON public.cinu_classes (version_id, code);
CREATE INDEX IF NOT EXISTS cinu_classes_group_id_idx ON public.cinu_classes (group_id);
CREATE INDEX IF NOT EXISTS cinu_classes_name_trgm_idx ON public.cinu_classes USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS cinu_classes_code_trgm_idx ON public.cinu_classes USING gin (code gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.cinu_subclasses (
  id         TEXT PRIMARY KEY,
  version_id TEXT NOT NULL,
  class_id   TEXT NOT NULL,
  code       VARCHAR(16) NOT NULL,
  name       VARCHAR(300) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cinu_subclasses_class_version_fkey
    FOREIGN KEY (class_id, version_id)
    REFERENCES public.cinu_classes (id, version_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT cinu_subclasses_code_chk CHECK (code ~ '^[0-9]{5}$'),
  CONSTRAINT cinu_subclasses_name_chk CHECK (char_length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS cinu_subclasses_version_code_key ON public.cinu_subclasses (version_id, code);
CREATE INDEX IF NOT EXISTS cinu_subclasses_class_id_idx ON public.cinu_subclasses (class_id);
CREATE INDEX IF NOT EXISTS cinu_subclasses_name_trgm_idx ON public.cinu_subclasses USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS cinu_subclasses_code_trgm_idx ON public.cinu_subclasses USING gin (code gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.entity_economic_activities (
  id               TEXT PRIMARY KEY,
  entity_id        TEXT NOT NULL REFERENCES public.entities (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  cinu_class_id    TEXT NOT NULL REFERENCES public.cinu_classes (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  cinu_subclass_id TEXT REFERENCES public.cinu_subclasses (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  is_primary       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at       TIMESTAMP(3),
  created_by_id    TEXT REFERENCES public.users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  updated_by_id    TEXT REFERENCES public.users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  deleted_by_id    TEXT REFERENCES public.users (id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS entity_economic_activities_entity_id_idx
  ON public.entity_economic_activities (entity_id);
CREATE INDEX IF NOT EXISTS entity_economic_activities_class_id_idx
  ON public.entity_economic_activities (cinu_class_id);
CREATE INDEX IF NOT EXISTS entity_economic_activities_subclass_id_idx
  ON public.entity_economic_activities (cinu_subclass_id);
CREATE INDEX IF NOT EXISTS entity_economic_activities_deleted_at_idx
  ON public.entity_economic_activities (deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS entity_economic_activities_active_pair_uidx
  ON public.entity_economic_activities (entity_id, cinu_class_id, (COALESCE(cinu_subclass_id, '')))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS entity_economic_activities_one_primary_uidx
  ON public.entity_economic_activities (entity_id)
  WHERE is_primary AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS entity_economic_activities_active_entity_idx
  ON public.entity_economic_activities (entity_id)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Integridad: prefijo padre, subclase de la clase, misma versión, sin DELETE
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_guard_cinu_prefix()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent text;
BEGIN
  IF TG_TABLE_NAME = 'cinu_groups' THEN
    SELECT code INTO v_parent
      FROM public.cinu_divisions
     WHERE id = NEW.division_id AND version_id = NEW.version_id;
    IF v_parent IS NULL THEN
      RAISE EXCEPTION 'División inexistente para el grupo' USING ERRCODE = '23503';
    END IF;
    IF left(NEW.code, char_length(v_parent)) IS DISTINCT FROM v_parent THEN
      RAISE EXCEPTION 'El código de grupo no corresponde a su división' USING ERRCODE = '22023';
    END IF;
  ELSIF TG_TABLE_NAME = 'cinu_classes' THEN
    SELECT code INTO v_parent
      FROM public.cinu_groups
     WHERE id = NEW.group_id AND version_id = NEW.version_id;
    IF v_parent IS NULL THEN
      RAISE EXCEPTION 'Grupo inexistente para la clase' USING ERRCODE = '23503';
    END IF;
    IF left(NEW.code, char_length(v_parent)) IS DISTINCT FROM v_parent THEN
      RAISE EXCEPTION 'El código de clase no corresponde a su grupo' USING ERRCODE = '22023';
    END IF;
  ELSIF TG_TABLE_NAME = 'cinu_subclasses' THEN
    SELECT code INTO v_parent
      FROM public.cinu_classes
     WHERE id = NEW.class_id AND version_id = NEW.version_id;
    IF v_parent IS NULL THEN
      RAISE EXCEPTION 'Clase inexistente para la subclase' USING ERRCODE = '23503';
    END IF;
    IF left(NEW.code, char_length(v_parent)) IS DISTINCT FROM v_parent THEN
      RAISE EXCEPTION 'El código de subclase no corresponde a su clase' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cinu_groups_prefix ON public.cinu_groups;
CREATE TRIGGER trg_cinu_groups_prefix
  BEFORE INSERT OR UPDATE OF code, division_id, version_id ON public.cinu_groups
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_cinu_prefix();

DROP TRIGGER IF EXISTS trg_cinu_classes_prefix ON public.cinu_classes;
CREATE TRIGGER trg_cinu_classes_prefix
  BEFORE INSERT OR UPDATE OF code, group_id, version_id ON public.cinu_classes
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_cinu_prefix();

DROP TRIGGER IF EXISTS trg_cinu_subclasses_prefix ON public.cinu_subclasses;
CREATE TRIGGER trg_cinu_subclasses_prefix
  BEFORE INSERT OR UPDATE OF code, class_id, version_id ON public.cinu_subclasses
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_cinu_prefix();

CREATE OR REPLACE FUNCTION public.fn_guard_entity_economic_activity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_class_version text;
  v_sub_class text;
  v_sub_version text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.entities e WHERE e.id = NEW.entity_id) THEN
    RAISE EXCEPTION 'Entidad no encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NEW.deleted_at IS NULL AND EXISTS (
    SELECT 1 FROM public.entities e WHERE e.id = NEW.entity_id AND e.deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Entidad no encontrada' USING ERRCODE = 'P0002';
  END IF;

  SELECT c.version_id INTO v_class_version
    FROM public.cinu_classes c
   WHERE c.id = NEW.cinu_class_id;
  IF v_class_version IS NULL THEN
    RAISE EXCEPTION 'Clase económica inexistente' USING ERRCODE = '23503';
  END IF;

  IF NEW.cinu_subclass_id IS NOT NULL THEN
    SELECT s.class_id, s.version_id INTO v_sub_class, v_sub_version
      FROM public.cinu_subclasses s
     WHERE s.id = NEW.cinu_subclass_id;
    IF v_sub_class IS NULL THEN
      RAISE EXCEPTION 'Subclase económica inexistente' USING ERRCODE = '23503';
    END IF;
    IF v_sub_class <> NEW.cinu_class_id THEN
      RAISE EXCEPTION 'La subclase no pertenece a la clase seleccionada' USING ERRCODE = '23514';
    END IF;
    IF v_sub_version IS DISTINCT FROM v_class_version THEN
      RAISE EXCEPTION 'La clase y la subclase deben pertenecer a la misma versión del catálogo' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_entity_economic_activities_guard ON public.entity_economic_activities;
CREATE TRIGGER trg_entity_economic_activities_guard
  BEFORE INSERT OR UPDATE ON public.entity_economic_activities
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_entity_economic_activity();

DROP TRIGGER IF EXISTS trg_entity_economic_activities_no_delete ON public.entity_economic_activities;
CREATE TRIGGER trg_entity_economic_activities_no_delete
  BEFORE DELETE ON public.entity_economic_activities
  FOR EACH ROW EXECUTE FUNCTION public.fn_reject_physical_delete();

DROP TRIGGER IF EXISTS trg_cinu_versions_no_delete ON public.cinu_versions;
CREATE TRIGGER trg_cinu_versions_no_delete
  BEFORE DELETE ON public.cinu_versions
  FOR EACH ROW EXECUTE FUNCTION public.fn_reject_physical_delete();

DROP TRIGGER IF EXISTS trg_cinu_categories_no_delete ON public.cinu_categories;
CREATE TRIGGER trg_cinu_categories_no_delete
  BEFORE DELETE ON public.cinu_categories
  FOR EACH ROW EXECUTE FUNCTION public.fn_reject_physical_delete();

DROP TRIGGER IF EXISTS trg_cinu_divisions_no_delete ON public.cinu_divisions;
CREATE TRIGGER trg_cinu_divisions_no_delete
  BEFORE DELETE ON public.cinu_divisions
  FOR EACH ROW EXECUTE FUNCTION public.fn_reject_physical_delete();

DROP TRIGGER IF EXISTS trg_cinu_groups_no_delete ON public.cinu_groups;
CREATE TRIGGER trg_cinu_groups_no_delete
  BEFORE DELETE ON public.cinu_groups
  FOR EACH ROW EXECUTE FUNCTION public.fn_reject_physical_delete();

DROP TRIGGER IF EXISTS trg_cinu_classes_no_delete ON public.cinu_classes;
CREATE TRIGGER trg_cinu_classes_no_delete
  BEFORE DELETE ON public.cinu_classes
  FOR EACH ROW EXECUTE FUNCTION public.fn_reject_physical_delete();

DROP TRIGGER IF EXISTS trg_cinu_subclasses_no_delete ON public.cinu_subclasses;
CREATE TRIGGER trg_cinu_subclasses_no_delete
  BEFORE DELETE ON public.cinu_subclasses
  FOR EACH ROW EXECUTE FUNCTION public.fn_reject_physical_delete();

DROP TRIGGER IF EXISTS trg_entity_economic_activities_audit ON public.entity_economic_activities;
CREATE TRIGGER trg_entity_economic_activities_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.entity_economic_activities
  FOR EACH ROW EXECUTE FUNCTION audit.fn_audit_trigger();

-- ---------------------------------------------------------------------------
-- Funciones de catálogo e importación idempotente
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION api.fn_upsert_cinu_version(
  p_code text,
  p_name text,
  p_source text
) RETURNS TABLE (out_id text, out_inserted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id text;
  v_code text := btrim(coalesce(p_code, ''));
  v_name text := btrim(coalesce(p_name, ''));
BEGIN
  IF v_code = '' OR v_name = '' THEN
    RAISE EXCEPTION 'Código y nombre de versión son requeridos' USING ERRCODE = '22023';
  END IF;

  SELECT v.id INTO v_id FROM public.cinu_versions v WHERE v.code = v_code;
  IF v_id IS NOT NULL THEN
    UPDATE public.cinu_versions
       SET name = left(v_name, 200),
           source = NULLIF(left(btrim(coalesce(p_source, '')), 400), ''),
           updated_at = CURRENT_TIMESTAMP
     WHERE id = v_id;
    out_id := v_id;
    out_inserted := false;
    RETURN NEXT;
    RETURN;
  END IF;

  v_id := gen_random_uuid()::text;
  INSERT INTO public.cinu_versions (id, code, name, source, is_active, created_at, updated_at)
  VALUES (
    v_id,
    left(v_code, 32),
    left(v_name, 200),
    NULLIF(left(btrim(coalesce(p_source, '')), 400), ''),
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );
  out_id := v_id;
  out_inserted := true;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION api.fn_upsert_cinu_category(
  p_version_id text,
  p_code text,
  p_name text
) RETURNS TABLE (out_id text, out_inserted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id text;
  v_code text := btrim(coalesce(p_code, ''));
  v_name text := btrim(coalesce(p_name, ''));
BEGIN
  IF p_version_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.cinu_versions v WHERE v.id = p_version_id) THEN
    RAISE EXCEPTION 'Versión de catálogo inexistente' USING ERRCODE = '23503';
  END IF;
  IF v_code !~ '^[A-Z]$' OR v_name = '' THEN
    RAISE EXCEPTION 'Categoría inválida' USING ERRCODE = '22023';
  END IF;

  SELECT c.id INTO v_id
    FROM public.cinu_categories c
   WHERE c.version_id = p_version_id AND c.code = v_code;
  IF v_id IS NOT NULL THEN
    UPDATE public.cinu_categories
       SET name = left(v_name, 300), updated_at = CURRENT_TIMESTAMP
     WHERE id = v_id;
    out_id := v_id;
    out_inserted := false;
    RETURN NEXT;
    RETURN;
  END IF;

  v_id := gen_random_uuid()::text;
  INSERT INTO public.cinu_categories (id, version_id, code, name, created_at, updated_at)
  VALUES (v_id, p_version_id, v_code, left(v_name, 300), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  out_id := v_id;
  out_inserted := true;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION api.fn_upsert_cinu_division(
  p_category_id text,
  p_code text,
  p_name text
) RETURNS TABLE (out_id text, out_inserted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id text;
  v_version text;
  v_code text := btrim(coalesce(p_code, ''));
  v_name text := btrim(coalesce(p_name, ''));
BEGIN
  SELECT c.version_id INTO v_version FROM public.cinu_categories c WHERE c.id = p_category_id;
  IF v_version IS NULL THEN
    RAISE EXCEPTION 'Categoría inexistente' USING ERRCODE = '23503';
  END IF;
  IF v_code !~ '^[0-9]{2}$' OR v_name = '' THEN
    RAISE EXCEPTION 'División inválida' USING ERRCODE = '22023';
  END IF;

  SELECT d.id INTO v_id
    FROM public.cinu_divisions d
   WHERE d.version_id = v_version AND d.code = v_code;
  IF v_id IS NOT NULL THEN
    UPDATE public.cinu_divisions
       SET name = left(v_name, 300), updated_at = CURRENT_TIMESTAMP
     WHERE id = v_id;
    out_id := v_id;
    out_inserted := false;
    RETURN NEXT;
    RETURN;
  END IF;

  v_id := gen_random_uuid()::text;
  INSERT INTO public.cinu_divisions (id, version_id, category_id, code, name, created_at, updated_at)
  VALUES (v_id, v_version, p_category_id, v_code, left(v_name, 300), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  out_id := v_id;
  out_inserted := true;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION api.fn_upsert_cinu_group(
  p_division_id text,
  p_code text,
  p_name text
) RETURNS TABLE (out_id text, out_inserted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id text;
  v_version text;
  v_parent text;
  v_code text := btrim(coalesce(p_code, ''));
  v_name text := btrim(coalesce(p_name, ''));
BEGIN
  SELECT d.version_id, d.code INTO v_version, v_parent
    FROM public.cinu_divisions d WHERE d.id = p_division_id;
  IF v_version IS NULL THEN
    RAISE EXCEPTION 'División inexistente' USING ERRCODE = '23503';
  END IF;
  IF v_code !~ '^[0-9]{3}$' OR left(v_code, 2) IS DISTINCT FROM v_parent OR v_name = '' THEN
    RAISE EXCEPTION 'El código de grupo no corresponde a su división' USING ERRCODE = '22023';
  END IF;

  SELECT g.id INTO v_id
    FROM public.cinu_groups g
   WHERE g.version_id = v_version AND g.code = v_code;
  IF v_id IS NOT NULL THEN
    UPDATE public.cinu_groups
       SET name = left(v_name, 300), updated_at = CURRENT_TIMESTAMP
     WHERE id = v_id;
    out_id := v_id;
    out_inserted := false;
    RETURN NEXT;
    RETURN;
  END IF;

  v_id := gen_random_uuid()::text;
  INSERT INTO public.cinu_groups (id, version_id, division_id, code, name, created_at, updated_at)
  VALUES (v_id, v_version, p_division_id, v_code, left(v_name, 300), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  out_id := v_id;
  out_inserted := true;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION api.fn_upsert_cinu_class(
  p_group_id text,
  p_code text,
  p_name text
) RETURNS TABLE (out_id text, out_inserted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id text;
  v_version text;
  v_parent text;
  v_code text := btrim(coalesce(p_code, ''));
  v_name text := btrim(coalesce(p_name, ''));
BEGIN
  SELECT g.version_id, g.code INTO v_version, v_parent
    FROM public.cinu_groups g WHERE g.id = p_group_id;
  IF v_version IS NULL THEN
    RAISE EXCEPTION 'Grupo inexistente' USING ERRCODE = '23503';
  END IF;
  IF v_code !~ '^[0-9]{4}$' OR left(v_code, 3) IS DISTINCT FROM v_parent OR v_name = '' THEN
    RAISE EXCEPTION 'El código de clase no corresponde a su grupo' USING ERRCODE = '22023';
  END IF;

  SELECT c.id INTO v_id
    FROM public.cinu_classes c
   WHERE c.version_id = v_version AND c.code = v_code;
  IF v_id IS NOT NULL THEN
    UPDATE public.cinu_classes
       SET name = left(v_name, 300), updated_at = CURRENT_TIMESTAMP
     WHERE id = v_id;
    out_id := v_id;
    out_inserted := false;
    RETURN NEXT;
    RETURN;
  END IF;

  v_id := gen_random_uuid()::text;
  INSERT INTO public.cinu_classes (id, version_id, group_id, code, name, created_at, updated_at)
  VALUES (v_id, v_version, p_group_id, v_code, left(v_name, 300), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  out_id := v_id;
  out_inserted := true;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION api.fn_upsert_cinu_subclass(
  p_class_id text,
  p_code text,
  p_name text
) RETURNS TABLE (out_id text, out_inserted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id text;
  v_version text;
  v_parent text;
  v_code text := btrim(coalesce(p_code, ''));
  v_name text := btrim(coalesce(p_name, ''));
BEGIN
  SELECT c.version_id, c.code INTO v_version, v_parent
    FROM public.cinu_classes c WHERE c.id = p_class_id;
  IF v_version IS NULL THEN
    RAISE EXCEPTION 'Clase inexistente' USING ERRCODE = '23503';
  END IF;
  IF v_code !~ '^[0-9]{5}$' OR left(v_code, 4) IS DISTINCT FROM v_parent OR v_name = '' THEN
    RAISE EXCEPTION 'El código de subclase no corresponde a su clase' USING ERRCODE = '22023';
  END IF;

  SELECT s.id INTO v_id
    FROM public.cinu_subclasses s
   WHERE s.version_id = v_version AND s.code = v_code;
  IF v_id IS NOT NULL THEN
    UPDATE public.cinu_subclasses
       SET name = left(v_name, 300), updated_at = CURRENT_TIMESTAMP
     WHERE id = v_id;
    out_id := v_id;
    out_inserted := false;
    RETURN NEXT;
    RETURN;
  END IF;

  v_id := gen_random_uuid()::text;
  INSERT INTO public.cinu_subclasses (id, version_id, class_id, code, name, created_at, updated_at)
  VALUES (v_id, v_version, p_class_id, v_code, left(v_name, 300), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  out_id := v_id;
  out_inserted := true;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Lectura del catálogo y de actividades
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION api.fn_resolve_cinu_version(p_version_code text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id text;
BEGIN
  IF p_version_code IS NOT NULL AND btrim(p_version_code) <> '' THEN
    SELECT v.id INTO v_id FROM public.cinu_versions v WHERE v.code = btrim(p_version_code);
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Versión de catálogo no encontrada' USING ERRCODE = 'P0002';
    END IF;
    RETURN v_id;
  END IF;

  SELECT v.id INTO v_id FROM public.cinu_versions v WHERE v.is_active ORDER BY v.created_at DESC LIMIT 1;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Versión de catálogo no encontrada' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION api.fn_get_cinu_categories(p_version_code text)
RETURNS TABLE (
  id text,
  version_id text,
  version_code varchar,
  code varchar,
  name varchar
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_version text;
BEGIN
  v_version := api.fn_resolve_cinu_version(p_version_code);
  RETURN QUERY
  SELECT c.id, c.version_id, v.code, c.code, c.name
    FROM public.cinu_categories c
    JOIN public.cinu_versions v ON v.id = c.version_id
   WHERE c.version_id = v_version
   ORDER BY c.code;
END;
$$;

CREATE OR REPLACE FUNCTION api.fn_get_cinu_divisions(p_category_id text)
RETURNS TABLE (
  id text,
  version_id text,
  category_id text,
  code varchar,
  name varchar
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_category_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.cinu_categories c WHERE c.id = p_category_id) THEN
    RAISE EXCEPTION 'Categoría no encontrada' USING ERRCODE = 'P0002';
  END IF;
  RETURN QUERY
  SELECT d.id, d.version_id, d.category_id, d.code, d.name
    FROM public.cinu_divisions d
   WHERE d.category_id = p_category_id
   ORDER BY d.code;
END;
$$;

CREATE OR REPLACE FUNCTION api.fn_get_cinu_groups(p_division_id text)
RETURNS TABLE (
  id text,
  version_id text,
  division_id text,
  code varchar,
  name varchar
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_division_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.cinu_divisions d WHERE d.id = p_division_id) THEN
    RAISE EXCEPTION 'División no encontrada' USING ERRCODE = 'P0002';
  END IF;
  RETURN QUERY
  SELECT g.id, g.version_id, g.division_id, g.code, g.name
    FROM public.cinu_groups g
   WHERE g.division_id = p_division_id
   ORDER BY g.code;
END;
$$;

CREATE OR REPLACE FUNCTION api.fn_get_cinu_classes(p_group_id text)
RETURNS TABLE (
  id text,
  version_id text,
  group_id text,
  code varchar,
  name varchar
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_group_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.cinu_groups g WHERE g.id = p_group_id) THEN
    RAISE EXCEPTION 'Grupo no encontrado' USING ERRCODE = 'P0002';
  END IF;
  RETURN QUERY
  SELECT c.id, c.version_id, c.group_id, c.code, c.name
    FROM public.cinu_classes c
   WHERE c.group_id = p_group_id
   ORDER BY c.code;
END;
$$;

CREATE OR REPLACE FUNCTION api.fn_get_cinu_subclasses(p_class_id text)
RETURNS TABLE (
  id text,
  version_id text,
  class_id text,
  code varchar,
  name varchar
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_class_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.cinu_classes c WHERE c.id = p_class_id) THEN
    RAISE EXCEPTION 'Clase no encontrada' USING ERRCODE = 'P0002';
  END IF;
  RETURN QUERY
  SELECT s.id, s.version_id, s.class_id, s.code, s.name
    FROM public.cinu_subclasses s
   WHERE s.class_id = p_class_id
   ORDER BY s.code;
END;
$$;

CREATE OR REPLACE FUNCTION api.fn_search_economic_activities(p_query text, p_limit integer)
RETURNS TABLE (
  level text,
  id text,
  code varchar,
  name varchar,
  class_id text,
  class_code varchar,
  class_name varchar,
  group_code varchar,
  division_code varchar,
  category_code varchar,
  version_code varchar
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_q text;
  v_limit integer;
  v_version text;
BEGIN
  IF p_query IS NULL OR char_length(btrim(p_query)) < 2 THEN
    RAISE EXCEPTION 'La búsqueda requiere al menos 2 caracteres' USING ERRCODE = '22023';
  END IF;
  v_q := '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_limit := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_version := api.fn_resolve_cinu_version(NULL);

  RETURN QUERY
  SELECT *
    FROM (
      SELECT
        'clase'::text AS level,
        c.id,
        c.code,
        c.name,
        c.id AS class_id,
        c.code AS class_code,
        c.name AS class_name,
        g.code AS group_code,
        d.code AS division_code,
        cat.code AS category_code,
        v.code AS version_code
      FROM public.cinu_classes c
      JOIN public.cinu_groups g ON g.id = c.group_id
      JOIN public.cinu_divisions d ON d.id = g.division_id
      JOIN public.cinu_categories cat ON cat.id = d.category_id
      JOIN public.cinu_versions v ON v.id = c.version_id
      WHERE c.version_id = v_version
        AND (c.code ILIKE v_q ESCAPE '\' OR c.name ILIKE v_q ESCAPE '\')
      UNION ALL
      SELECT
        'subclase'::text,
        s.id,
        s.code,
        s.name,
        c.id,
        c.code,
        c.name,
        g.code,
        d.code,
        cat.code,
        v.code
      FROM public.cinu_subclasses s
      JOIN public.cinu_classes c ON c.id = s.class_id
      JOIN public.cinu_groups g ON g.id = c.group_id
      JOIN public.cinu_divisions d ON d.id = g.division_id
      JOIN public.cinu_categories cat ON cat.id = d.category_id
      JOIN public.cinu_versions v ON v.id = s.version_id
      WHERE s.version_id = v_version
        AND (s.code ILIKE v_q ESCAPE '\' OR s.name ILIKE v_q ESCAPE '\')
    ) hits
   ORDER BY hits.code
   LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION api.fn_map_economic_activity(p_activity_id text)
RETURNS TABLE (
  id text,
  entity_id text,
  cinu_class_id text,
  cinu_subclass_id text,
  is_primary boolean,
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

CREATE OR REPLACE FUNCTION api.fn_log_economic_activity(
  p_action text,
  p_entity_id text,
  p_activity_id text,
  p_actor_id text,
  p_label text,
  p_before jsonb,
  p_after jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id text;
  v_email text;
  v_username text;
  v_sede text;
  v_departamento text;
BEGIN
  IF p_actor_id IS NOT NULL AND btrim(p_actor_id) <> '' THEN
    SELECT u.id, u.email, u.username, s.name, d.name
      INTO v_user_id, v_email, v_username, v_sede, v_departamento
      FROM public.users u
      LEFT JOIN public.sedes s ON s.id = u.sede_id
      LEFT JOIN public.departamentos d ON d.id = u.departamento_id
     WHERE u.id = p_actor_id;
  END IF;

  INSERT INTO public.audit_logs (
    id, action, entity_type, entity_id, entity_label, user_id, user_email, metadata, created_at
  ) VALUES (
    gen_random_uuid()::text,
    p_action::"AuditAction",
    'ECONOMIC_ACTIVITY',
    p_entity_id,
    left(coalesce(p_label, ''), 300),
    v_user_id,
    v_email,
    jsonb_build_object(
      'anterior', p_before,
      'nuevo', p_after,
      'usuario', CASE
        WHEN v_username IS NULL THEN NULL
        WHEN position('@' in v_username) > 0 THEN split_part(v_username, '@', 1)
        ELSE v_username
      END,
      'sede', v_sede,
      'departamento', v_departamento,
      'activityId', p_activity_id
    ),
    CURRENT_TIMESTAMP
  );
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
    'principal', m.is_primary
  )
  FROM api.fn_map_economic_activity(p_activity_id) m;
$$;

CREATE OR REPLACE FUNCTION api.fn_assign_entity_economic_activity(
  p_entity_id text,
  p_class_id text,
  p_subclass_id text,
  p_is_primary boolean,
  p_actor_id text
) RETURNS TABLE (
  id text,
  entity_id text,
  cinu_class_id text,
  cinu_subclass_id text,
  is_primary boolean,
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
           updated_at = CURRENT_TIMESTAMP,
           updated_by_id = v_actor
     WHERE id = v_id;
  ELSE
    v_id := gen_random_uuid()::text;
    INSERT INTO public.entity_economic_activities (
      id, entity_id, cinu_class_id, cinu_subclass_id, is_primary,
      created_at, updated_at, created_by_id, updated_by_id
    ) VALUES (
      v_id, p_entity_id, p_class_id, v_subclass, v_primary,
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

-- ---------------------------------------------------------------------------
-- Privilegios mínimos
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE
  public.cinu_versions,
  public.cinu_categories,
  public.cinu_divisions,
  public.cinu_groups,
  public.cinu_classes,
  public.cinu_subclasses,
  public.entity_economic_activities
FROM PUBLIC, crm_api, crm_readonly_admin;

REVOKE ALL ON FUNCTION
  api.fn_upsert_cinu_version(text, text, text),
  api.fn_upsert_cinu_category(text, text, text),
  api.fn_upsert_cinu_division(text, text, text),
  api.fn_upsert_cinu_group(text, text, text),
  api.fn_upsert_cinu_class(text, text, text),
  api.fn_upsert_cinu_subclass(text, text, text),
  api.fn_resolve_cinu_version(text),
  api.fn_get_cinu_categories(text),
  api.fn_get_cinu_divisions(text),
  api.fn_get_cinu_groups(text),
  api.fn_get_cinu_classes(text),
  api.fn_get_cinu_subclasses(text),
  api.fn_search_economic_activities(text, integer),
  api.fn_map_economic_activity(text),
  api.fn_get_entity_economic_activities(text),
  api.fn_log_economic_activity(text, text, text, text, text, jsonb, jsonb),
  api.fn_activity_audit_payload(text),
  api.fn_assign_entity_economic_activity(text, text, text, boolean, text),
  api.fn_set_primary_economic_activity(text, text, text),
  api.fn_remove_entity_economic_activity(text, text, text)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  api.fn_get_cinu_categories(text),
  api.fn_get_cinu_divisions(text),
  api.fn_get_cinu_groups(text),
  api.fn_get_cinu_classes(text),
  api.fn_get_cinu_subclasses(text),
  api.fn_search_economic_activities(text, integer),
  api.fn_get_entity_economic_activities(text)
TO crm_api, crm_readonly_admin;

GRANT EXECUTE ON FUNCTION
  api.fn_assign_entity_economic_activity(text, text, text, boolean, text),
  api.fn_set_primary_economic_activity(text, text, text),
  api.fn_remove_entity_economic_activity(text, text, text),
  api.fn_upsert_cinu_version(text, text, text),
  api.fn_upsert_cinu_category(text, text, text),
  api.fn_upsert_cinu_division(text, text, text),
  api.fn_upsert_cinu_group(text, text, text),
  api.fn_upsert_cinu_class(text, text, text),
  api.fn_upsert_cinu_subclass(text, text, text)
TO crm_api;

REVOKE ALL ON FUNCTION
  api.fn_map_economic_activity(text),
  api.fn_log_economic_activity(text, text, text, text, text, jsonb, jsonb),
  api.fn_activity_audit_payload(text),
  api.fn_resolve_cinu_version(text)
FROM crm_api, crm_readonly_admin;
