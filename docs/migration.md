# Clasificación persona vs empresa al importar CSV

Este documento describe **cómo el backend decide** si una fila del CSV es persona, empresa o ambas, y por qué un lote puede terminar **solo con personas**.

Código de referencia:

- `backend/src/modules/imports/mapper.service.ts` — `applyMapping`, `classifyImportRow`, `inferEntityType`
- `backend/src/modules/imports/import.types.ts` — plantilla `UNIFICADA_TEMPLATE`
- `backend/src/modules/imports/import.service.ts` — `importUnificadaRow`
- `backend/src/modules/verifications/verification.mapper.ts` — tipo que ve la cola de verificación

---

## 1. Qué columnas usa el sistema

No lee “persona” o “empresa” como texto en el CSV. Clasifica según **campos extraídos** después del mapeo de columnas.

### Plantilla UNIFICADA / GENERAL / CENSUS

| Campo interno | Columna CSV esperada (header normalizado) |
|---------------|-------------------------------------------|
| `firstName` | `nombre` |
| `lastName` | `apellido` |
| `cedula` | `cedula` |
| `ruc` | `ruc` |
| `legalName` y `businessName` | **`empresa`** |
| `email` | `correo` |
| `phone` | `telefono` |
| ubicación | `provincia`, `distrito`, `corregimiento`, `direccion` |

Los headers se normalizan: minúsculas, sin acentos, espacios → `_`.

Ejemplo real:

```text
Nombre;Apellido;Cédula;RUC;Empresa;Teléfono;Correo;Provincia;Distrito;Corregimiento
```

queda:

```text
nombre, apellido, cedula, ruc, empresa, telefono, correo, provincia, distrito, corregimiento
```

Si el tipo de fuente **no** es UNIFICADA (p. ej. EVENTO), `empresa` puede no mapearse a menos que el auto-detect o el mapeo manual lo hagan. Sin esa columna mapeada, **no hay empresa**.

---

## 2. Qué se extrae de cada fila (`applyMapping`)

De la fila cruda + mapeo salen solo estos campos para clasificar:

| Campo extraído | Origen |
|----------------|--------|
| `extractedCedula` | columna cédula (solo dígitos) |
| `extractedRuc` | columna RUC (dígitos y guiones) |
| `extractedFirstName` | columna nombre |
| `extractedLastName` | columna apellido |
| `extractedBusinessName` | `businessName` **o** `legalName` **o** `tradeName` (en UNIFICADA: columna **Empresa**) |
| email / teléfono | contacto (no influyen en persona vs empresa) |

Si `nombre` trae un nombre completo y `apellido` está vacío, se parte el texto (`Juan Pérez` → nombre + apellido). Eso **no** se aplica a la columna Empresa.

Valores vacíos, `-`, `n/a`, `s/n` se tratan como “sin dato”.

---

## 3. Regla de clasificación (`classifyImportRow`)

```text
hayPersona  = cédula O nombre O apellido
hayEmpresa  = RUC O nombre de empresa (columna Empresa)

si hayPersona Y hayEmpresa  →  BOTH
si solo hayEmpresa          →  COMPANY
en cualquier otro caso      →  PERSON   ← incluye filas vacías
```

No hay análisis del texto (“S.A.”, “Kiosko”, etc.).  
No se usa el teléfono ni la dirección para decidir el tipo.

### Tabla con filas típicas del CSV AMPYME

| Nombre | Apellido | Cédula | RUC | Empresa | Clasificación real |
|--------|----------|--------|-----|---------|--------------------|
| *(vacío)* | | | | `ebanisteria` | **COMPANY** |
| *(vacío)* | | | | `MULTI VENTAS IDALIDES` | **COMPANY** |
| `xiomara` | `atencio` | | | `CAFETERIA YAMI` | **BOTH** |
| `Ana` | `Pérez` | `8-123-456` | | | **PERSON** |
| *(todo vacío)* | | | | | **PERSON** (fallback) |

En el CSV de carga, **RUC casi siempre viene vacío**. La empresa se detecta **solo** por la columna `Empresa`.

---

## 4. Dónde se “pierden” las empresas (bug actual)

Hay **tres pasos** y no todos respetan `BOTH` ni `COMPANY`.

### 4.1 Cola de verificación (lo que ves en pantalla)

`verification.mapper.ts`:

```ts
entityType = kind === 'COMPANY' ? 'COMPANY' : 'PERSON'
```

| `classifyImportRow` | Lo que guarda `verification_items.entityType` |
|---------------------|-----------------------------------------------|
| COMPANY | COMPANY |
| PERSON | PERSON |
| **BOTH** | **PERSON** |

El enum de Prisma solo tiene `PERSON | COMPANY` (no existe `BOTH`).  
La fila con persona **y** empresa se etiqueta **Persona**. El snapshot JSON sí puede traer `company`, pero el listado y el filtro muestran Persona.

Eso explica filas como `xiomara / atencio / CAFETERIA YAMI`: hay empresa en el CSV y en el CRM aparece como persona.

### 4.2 Tipo primario (`inferEntityType`)

Misma idea: `BOTH` se trata como `PERSON` (validación, colas no unificadas).

### 4.3 Alta definitiva (`importUnificadaRow`)

Aquí sí se respeta la tripleta:

- PERSON → crea persona
- COMPANY → crea empresa
- BOTH → crea persona + empresa y las vincula (`OWNER`)

**Condición:** el lote debe ser fuente UNIFICADA/GENERAL/CENSUS **y** la fila debe llegar a este método con `extractedBusinessName` o `extractedRuc`.

Si el lote se ejecutó como EVENTO, o el mapeo no incluye `empresa`, nunca entra a crear empresa.

---

## 5. Por qué un lote puede quedar 100 % personas

Revisa en este orden:

1. **¿La columna `Empresa` está en el mapeo?**  
   En el lote: `columnMapping.businessName` o `legalName` = `empresa`.  
   Si no está, `extractedBusinessName` es null → `hayEmpresa = false` → todo es PERSON.

2. **¿El tipo de fuente es UNIFICADA?**  
   La plantilla que mapea `empresa` solo se aplica a `UNIFICADA`, `GENERAL` o `CENSUS`.

3. **¿Estás mirando la cola de verificación?**  
   Las filas BOTH se listan como Persona aunque el JSON tenga empresa.  
   Las COMPANY puras (nombre/apellido/cédula vacíos, solo Empresa) **sí** deberían decir Empresa. Si tampoco aparecen, el mapeo de `empresa` falló (punto 1).

4. **¿RUC vacío?**  
   Es normal en este CSV. No basta el RUC; tiene que existir el nombre en `Empresa`.

5. **¿Validaste/migraste el lote o solo miraste personas en el CRM?**  
   La cola puede tener COMPANY en `entityType` y, al validar, `importUnificadaRow` crea la empresa. Si el flujo de UI valida solo el snapshot de persona (`entityType: PERSON`), la empresa del snapshot BOTH puede no crearse en la pantalla de intake.

---

## 6. Flujo resumido

```text
CSV
  → normalizar headers
  → applyMapping (cédula, ruc, nombre, apellido, empresa, contacto)
  → classifyImportRow → PERSON | COMPANY | BOTH
        │
        ├─ staging_rows (guarda extracted_*)
        │
        ├─ verification_items.entityType
        │     COMPANY → COMPANY
        │     PERSON o BOTH → PERSON     ← aquí se ocultan empresas mixtas
        │
        └─ importUnificadaRow (solo fuente unificada, al ejecutar)
              PERSON  → persona
              COMPANY → empresa
              BOTH    → persona + empresa + relación OWNER
```

---

## 7. Cómo comprobar un lote ya cargado

En PostgreSQL:

```sql
-- ¿Se extrajo el nombre de empresa en staging?
SELECT
  COUNT(*) FILTER (WHERE extracted_business_name IS NOT NULL AND extracted_business_name <> '') AS con_empresa,
  COUNT(*) FILTER (WHERE extracted_ruc IS NOT NULL AND extracted_ruc <> '') AS con_ruc,
  COUNT(*) FILTER (WHERE extracted_first_name IS NOT NULL OR extracted_cedula IS NOT NULL) AS con_persona
FROM staging_rows
WHERE import_batch_id = '<batch-id>';

-- Qué tipo quedó en la cola de verificación
SELECT entity_type, COUNT(*)
FROM verification_items
WHERE import_batch_id = '<batch-id>'
GROUP BY entity_type;
```

Interpretación:

| Staging `con_empresa` | Verificación COMPANY | Diagnóstico |
|-----------------------|----------------------|-------------|
| 0 | 0 | Mapeo: columna Empresa no se extrajo |
| > 0 | 0 | Clasificación BOTH→PERSON o no se usó flujo unificado |
| > 0 | > 0 pero CRM sin empresas | Fallo al ejecutar `importUnificadaRow` / intake solo persona |

---

## 8. Comportamiento esperado vs CSV de ejemplo

Filas **solo Empresa** (sin nombre/apellido/cédula/RUC), p. ej. `KIOSKO YARIALYS`:

- Extraído: `extractedBusinessName = "Kiosko Yarialys"`
- Clase: **COMPANY**
- Cola: Empresa
- CRM: una empresa

Filas **nombre + apellido + Empresa**, p. ej. `xiomara atencio` + `CAFETERIA YAMI`:

- Clase: **BOTH**
- Cola hoy: **Persona** (bug de etiqueta; el snapshot puede traer `company`)
- CRM esperado: persona + empresa + relación dueño
- CRM hoy (típico): **solo persona**, si la validación usa `entityType = PERSON`

Ese segundo caso es el que hace parecer que “todas son personas y no se creó ninguna empresa”.
