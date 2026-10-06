-- Los seguimientos muestran users.username. Las cuentas creadas por AD
-- quedaron sin ese dato y la pantalla solo veía sede y departamento.
UPDATE public.users
SET username = split_part(lower(email), '@', 1)
WHERE position('@' IN email) > 0
  AND (
    username IS NULL
    OR btrim(username) = ''
    OR position('@' IN username) > 0
  );
