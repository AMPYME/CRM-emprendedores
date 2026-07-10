-- Migrar ubicación de entities: nombres → códigos con FK al catálogo

-- 1. Nuevas columnas de código
ALTER TABLE "entities" ADD COLUMN "cod_prov" CHAR(2);
ALTER TABLE "entities" ADD COLUMN "cod_dist" CHAR(4);
ALTER TABLE "entities" ADD COLUMN "cod_corr" CHAR(6);

-- 2. Provincia: nombre → codProv
UPDATE "entities" e
SET "cod_prov" = p."codProv"
FROM "provincias" p
WHERE e."province" IS NOT NULL
  AND TRIM(e."province") <> ''
  AND LOWER(TRIM(e."province")) = LOWER(TRIM(p."nombre"));

-- 3. Distrito: nombre → codDist (dentro de la provincia ya resuelta)
UPDATE "entities" e
SET "cod_dist" = d."codDist"
FROM "distritos" d
WHERE e."cod_prov" IS NOT NULL
  AND e."district" IS NOT NULL
  AND TRIM(e."district") <> ''
  AND d."codProv" = e."cod_prov"
  AND LOWER(TRIM(e."district")) = LOWER(TRIM(d."nombre"));

-- 4. Corregimiento: nombre → codCorr (dentro del distrito ya resuelto)
UPDATE "entities" e
SET "cod_corr" = c."codCorr"
FROM "corregimientos" c
WHERE e."cod_dist" IS NOT NULL
  AND e."corregimiento" IS NOT NULL
  AND TRIM(e."corregimiento") <> ''
  AND c."codDist" = e."cod_dist"
  AND LOWER(TRIM(e."corregimiento")) = LOWER(TRIM(c."nombre"));

-- 5. Eliminar columnas de texto libre
ALTER TABLE "entities" DROP COLUMN "province";
ALTER TABLE "entities" DROP COLUMN "district";
ALTER TABLE "entities" DROP COLUMN "corregimiento";

-- 6. FKs al catálogo
ALTER TABLE "entities" ADD CONSTRAINT "entities_cod_prov_fkey"
  FOREIGN KEY ("cod_prov") REFERENCES "provincias"("codProv") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "entities" ADD CONSTRAINT "entities_cod_dist_fkey"
  FOREIGN KEY ("cod_dist") REFERENCES "distritos"("codDist") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "entities" ADD CONSTRAINT "entities_cod_corr_fkey"
  FOREIGN KEY ("cod_corr") REFERENCES "corregimientos"("codCorr") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. Índice en provincia (código)
CREATE INDEX "entities_cod_prov_idx" ON "entities"("cod_prov");
