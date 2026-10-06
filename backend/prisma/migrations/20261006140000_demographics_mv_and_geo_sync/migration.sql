-- Al guardar el código político, completa provincia/distrito/corregimiento
-- para que el frontend (cod_prov, cod_dist, cod_corr) los muestre.

CREATE OR REPLACE FUNCTION public.fn_sync_entity_geo_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text;
  v_prov text;
  v_dist text;
  v_corr text;
BEGIN
  v_code := NULLIF(btrim(NEW.political_division_code), '');
  IF v_code IS NULL THEN
    RETURN NEW;
  END IF;

  IF length(v_code) >= 2 THEN
    v_prov := left(v_code, 2);
  END IF;
  IF length(v_code) >= 4 THEN
    v_dist := left(v_code, 4);
  END IF;
  IF length(v_code) = 6 THEN
    v_corr := v_code;
  END IF;

  IF v_prov IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.provincias p WHERE p."codProv" = v_prov
  ) THEN
    NEW.cod_prov := v_prov;
  END IF;

  IF v_dist IS NOT NULL AND NEW.cod_prov IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.distritos d WHERE d."codDist" = v_dist
  ) THEN
    NEW.cod_dist := v_dist;
  ELSE
    NEW.cod_dist := NULL;
  END IF;

  IF v_corr IS NOT NULL AND NEW.cod_dist IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.corregimientos c WHERE c."codCorr" = v_corr
  ) THEN
    NEW.cod_corr := v_corr;
  ELSE
    NEW.cod_corr := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_entities_sync_geo ON public.entities;
CREATE TRIGGER trg_entities_sync_geo
  BEFORE INSERT OR UPDATE OF political_division_code, cod_prov, cod_dist, cod_corr
  ON public.entities
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_entity_geo_columns();

-- Registros ya creados con código político y sin columnas legacy.
UPDATE public.entities e
SET political_division_code = e.political_division_code
WHERE e.political_division_code IS NOT NULL
  AND e.cod_prov IS NULL
  AND EXISTS (
    SELECT 1 FROM public.provincias p
    WHERE p."codProv" = left(e.political_division_code, 2)
  );

-- Vista materializada de demografía. El dashboard lee este resultado,
-- no recorre persons en cada visita.
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_person_demographics AS
SELECT
  COALESCE(p.gender::text, 'SIN_DATO') AS gender,
  CASE
    WHEN p.birth_date IS NULL THEN 'SIN_DATO'
    WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, p.birth_date)) < 18 THEN '0-17'
    WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, p.birth_date)) < 30 THEN '18-29'
    WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, p.birth_date)) < 45 THEN '30-44'
    WHEN EXTRACT(YEAR FROM age(CURRENT_DATE, p.birth_date)) < 60 THEN '45-59'
    ELSE '60+'
  END AS age_band,
  (upper(btrim(p.nationality_code)) <> 'PAN') AS is_foreign,
  CASE
    WHEN p.has_artisan_card IS TRUE THEN 'SI'
    WHEN p.has_artisan_card IS FALSE THEN 'NO'
    ELSE 'SIN_DATO'
  END AS is_artisan,
  COUNT(*)::int AS total
FROM public.persons p
JOIN public.entities e ON e.id = p.entity_id
WHERE p.deleted_at IS NULL
  AND e.deleted_at IS NULL
  AND e.entity_type = 'PERSON'
  AND e.status <> 'MERGED'
GROUP BY 1, 2, 3, 4
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_person_demographics_uidx
  ON public.mv_person_demographics (gender, age_band, is_foreign, is_artisan);

CREATE TABLE IF NOT EXISTS public.mv_refresh_state (
  view_name text PRIMARY KEY,
  refreshed_at timestamptz NOT NULL DEFAULT NOW()
);

INSERT INTO public.mv_refresh_state (view_name, refreshed_at)
VALUES ('mv_person_demographics', NOW())
ON CONFLICT (view_name) DO UPDATE SET refreshed_at = EXCLUDED.refreshed_at;
