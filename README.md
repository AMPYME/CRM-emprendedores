# CRM Emprendedores — Importaciones `.xlsx` y cola de verificación

Documento técnico del flujo de carga masiva desde Excel, dónde se persisten los datos en cada etapa, qué infraestructura de datos se usa y recomendaciones de arquitectura.

---

## 1. Resumen ejecutivo

Las importaciones **no crean Personas ni Empresas de inmediato**. El Excel pasa por un pipeline de staging → validación → cola de verificación → revisión humana → alta definitiva en el CRM.

**Base de datos de aplicación:** una sola instancia **PostgreSQL** (`emprendedores_db`).  
**Archivos Excel:** disco del servidor (`UPLOAD_DIR`), no una segunda base de datos.  
**Sesiones Intake / WebSocket:** tablas temporales en el **mismo PostgreSQL**; el WebSocket solo existe cuando un funcionario abre un registro.

No hay Redis, MongoDB ni un segundo motor SQL para este flujo.

---

## 2. Infraestructura de persistencia

| Recurso | Tecnología | Rol |
|--------|------------|-----|
| Datos de negocio + staging + verificación + intake | **PostgreSQL 16** | Única BD transaccional |
| Archivo `.xlsx` / `.xls` / `.csv` | **Filesystem** (`UPLOAD_DIR`) | Binario original para re-parseo |
| Tiempo real (borrador abierto) | **WebSocket** en el backend Node | Solo sesión activa; no almacena la cola |

### Esquema lógico (mismo `DATABASE_URL`)

```text
PostgreSQL (emprendedores_db)
├── import_batches          ← metadatos del lote
├── staging_rows            ← filas parseadas / validadas (pre-verificación)
├── verification_items      ← cola de verificación (IMPORT | FIELD)
├── intake_sessions + …     ← borrador interactivo (bajo demanda)
├── entities / persons / companies / …  ← CRM definitivo
└── audit_logs              ← trazabilidad
```

**Conclusión:** no se usan “muchas bases de datos”. Hay **un PostgreSQL** y **almacenamiento de archivos en disco**.

---

## 3. Flujo completo de importación `.xlsx`

```text
┌─────────────┐
│ 1. Subir    │  Multipart → disco (UPLOAD_DIR) + fila en import_batches
└──────┬──────┘
       ▼
┌─────────────┐
│ 2. Preview  │  Lee archivo del disco; no escribe filas de negocio
└──────┬──────┘
       ▼
┌─────────────┐
│ 3. Mapear   │  Guarda column_mapping (JSON) en import_batches
└──────┬──────┘
       ▼
┌─────────────┐
│ 4. Procesar │  Parsea Excel → inserta staging_rows (VALID / INVALID / DUPLICATE…)
└──────┬──────┘
       ▼
┌─────────────┐
│ 5. Revisar  │  UI sobre staging_rows (estado REVIEW_REQUIRED)
└──────┬──────┘
       ▼
┌──────────────────────────┐
│ 6. Enviar a verificación │  Bulk insert → verification_items (source=IMPORT)
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 7. Claim + Intake        │  Solo al pulsar "Verificar": IntakeSession + WS
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 8. Validar               │  Crea Person/Company + audit; status=VALIDATED
└──────────────────────────┘
```

### Endpoints principales

| Paso | Método | Ruta |
|------|--------|------|
| Subir | `POST` | `/api/v1/imports/upload` |
| Preview | `GET` | `/api/v1/imports/:id/preview` |
| Mapeo | `PUT` | `/api/v1/imports/:id/mapping` |
| Procesar | `POST` | `/api/v1/imports/:id/process` |
| Reintentar | `POST` | `/api/v1/imports/:id/retry` |
| Enviar a cola | `POST` | `/api/v1/imports/:id/send-to-verification` |
| Listar cola | `GET` | `/api/v1/verifications` |
| Reclamar | `POST` | `/api/v1/verifications/:id/claim` |
| Validar | `POST` | `/api/v1/verifications/:id/validate` |

---

## 4. ¿Dónde se guarda lo importado **antes** de verificación?

### 4.1 En el momento de subir el archivo

1. **Disco:** Multer guarda el binario en `UPLOAD_DIR` con nombre UUID (`{uuid}.xlsx`).
2. **PostgreSQL — `import_batches`:**
   - nombre original y nombre en disco
   - `source_type` (p. ej. `UNIFICADA`, `general`)
   - `status = PENDING`
   - `column_mapping` sugerido (si auto-detección / template encuentra columnas)
   - **aún no hay filas de datos de negocio**

En este punto **no** existen Personas, Empresas ni ítems de verificación.

### 4.2 Tras “Procesar” (staging)

El backend lee el archivo del disco, aplica el mapeo y hace **insert masivo** en:

**PostgreSQL — `staging_rows`**

| Campo relevante | Contenido |
|-----------------|-----------|
| `raw_data` (JSON) | Toda la fila del Excel (headers normalizados) |
| `extracted_*` | Cédula, RUC, nombre, email, teléfono, etc. |
| `status` | `VALID`, `INVALID`, `DUPLICATE_EXACT`, `DUPLICATE_POSSIBLE`, … |
| `validation_errors` | Errores de reglas de negocio |
| `import_batch_id` | FK al lote |

El lote pasa a `REVIEW_REQUIRED` (o equivalente operativo de revisión).

**Importante:** staging es la “zona intermedia” **antes** de la cola de verificación. Los datos viven en **el mismo PostgreSQL**, tablas distintas a `entities`.

### 4.3 Tras “Enviar a verificación”

Solo filas `VALID` (en bulk, lotes de ~500):

**PostgreSQL — `verification_items`**

| Campo | Contenido |
|-------|-----------|
| `source` | `IMPORT` |
| `status` | `PENDING` |
| `data` (JSON) | Snapshot precargado (formato intake) + metadatos de importación |
| `import_batch_id` / `staging_row_id` | Trazabilidad al lote y fila |
| `province` / `district` / `corregimiento` | Códigos normalizados del catálogo |

Las filas staging pasan a `QUEUED_FOR_VERIFICATION`.  
El lote a `VERIFICATION_QUEUED`.

**Todavía no** se crea `IntakeSession` ni conexión WebSocket por cada fila.

### 4.4 Solo cuando un funcionario pulsa “Verificar”

1. Claim atómico (`assigned_to_id`, `status = ASSIGNED` → `IN_REVIEW`).
2. Se crea **`intake_sessions`** (+ tablas `intake_entities` / `intake_persons` / …) en el **mismo PostgreSQL**.
3. Se precarga el borrador desde `verification_items.data`.
4. El frontend abre WebSocket **solo** para esa sesión (`/dashboard/intake/[sessionId]`).

### 4.5 Al validar

Se materializan registros en el modelo CRM (`entities` + `persons` / `companies` + contactos), se escribe auditoría y el ítem queda `VALIDATED` con `validated_entity_id`.

---

## 5. Estados del lote (`import_batches.status`)

| Estado (API) | Significado operativo |
|--------------|----------------------|
| `PENDING` | Archivo subido; pendiente de mapeo/proceso |
| `PROCESSING` / `VALIDATING` / `DEDUPLICATING` | Pipeline en curso |
| `REVIEW_REQUIRED` | Staging listo; revisar y enviar a verificación |
| `IMPORTING` | Transición hacia cola (envío masivo) |
| `VERIFICATION_QUEUED` | Filas válidas ya en `verification_items` |
| `COMPLETED` / `FAILED` / `CANCELLED` | Terminales / error / cancelación |

Estados de fila staging (resumen): `PENDING`, `VALID`, `INVALID`, `DUPLICATE_*`, `QUEUED_FOR_VERIFICATION`, `IMPORTED`, `SKIPPED`, `ERROR`.

---

## 6. Captura en campo vs importación

| Origen | `verification_items.source` | Cómo entra a la cola |
|--------|----------------------------|----------------------|
| Excel | `IMPORT` | `send-to-verification` desde staging |
| Formulario / QR | `FIELD` | Al crear sesión Intake de captura |

Ambos comparten cola y claim; se distinguen en UI (`IMPORTADO` / `CAPTURA EN CAMPO`).

---

## 7. WebSocket y TTL (por qué no saturan el servidor)

- **Cola pendiente:** filas en PostgreSQL. Los operadores en `/dashboard/intake` se suscriben al WebSocket (`subscribe_queue`) para ver altas/bajas en vivo, sin polling agresivo.
- **WS de sesión:** únicamente la sesión Intake abierta (`subscribe` + snapshot al guardar).
- **TTL captura en campo / QR:** `INTAKE_SESSION_TTL_MIN` (por defecto 20 min). Si expira, el ítem FIELD sigue asignado al funcionario.
- **TTL verificación de importación (no campo):** 30 minutos **sin cambios de datos**. El ping del WebSocket no renueva el plazo. Al expirar, la sesión se borra y el ítem vuelve a `PENDING` para que otro funcionario lo tome. Detalle en `backend/src/modules/intake/intake-ttl.ts`.

Diseño orientado a decenas de miles de pendientes sin N conexiones.

---

## 8. Diagrama de almacenamiento por etapa

```text
                    ┌──────────────────┐
   Archivo .xlsx ──►│ UPLOAD_DIR       │  (filesystem)
                    └────────┬─────────┘
                             │ metadatos
                             ▼
                    ┌──────────────────┐
                    │ import_batches   │  PostgreSQL
                    └────────┬─────────┘
                             │ process()
                             ▼
                    ┌──────────────────┐
                    │ staging_rows     │  ← AQUÍ están los datos
                    └────────┬─────────┘    ANTES de verificación
                             │ send-to-verification
                             ▼
                    ┌──────────────────┐
                    │ verification_    │  cola (PENDING…)
                    │ items            │
                    └────────┬─────────┘
                             │ claim()
                             ▼
                    ┌──────────────────┐
                    │ intake_*         │  borrador bajo demanda
                    └────────┬─────────┘
                             │ validate()
                             ▼
                    ┌──────────────────┐
                    │ entities /       │  CRM definitivo
                    │ persons/companies│
                    └──────────────────┘
```

---

## 9. Recomendaciones (evitar muchas BD y complejidad innecesaria)

### Mantener (recomendado)

1. **Una sola PostgreSQL** para CRM, staging, verificación, intake temporal y auditoría.
2. **Archivos en disco** (o object storage tipo S3/MinIO más adelante) — no meter blobs grandes en filas SQL salvo política explícita.
3. **Cola en tabla** (`verification_items`) en lugar de un broker (Rabbit/Kafka) mientras el volumen y el equipo sean manejables en un solo servicio.
4. **Bulk inserts** y filtros/paginación en SQL (ya diseñado así).

### Evitar

| Anti-patrón | Por qué |
|-------------|---------|
| Redis “porque es cola” | Duplica estado; la cola ya es PostgreSQL |
| Mongo/Elastic solo para staging | Segunda fuente de verdad y sync frágil |
| SQLite paralelo para intake | Dos motores, backups y transacciones cruzadas |
| Un WS por fila pendiente | Escala mal; contradice el diseño actual |
| Crear `entities` en el `process` | Salta la verificación humana |

### Mejoras opcionales (sin nueva BD)

- **Object storage** para `UPLOAD_DIR` en producción (mismo contrato: path/key en `import_batches`).
- **Particionado / archivado** de `staging_rows` antiguas tras `VERIFICATION_QUEUED` + retención.
- **Job asíncrono** (cola en proceso o `pg_boss` sobre el mismo Postgres) si los Excel de 50k+ filas bloquean el request HTTP.
- **Política de retención:** borrar o cold-storage del `.xlsx` tras N días si ya está en staging/verificación.

### Operación

- Backup único: dump de PostgreSQL + volumen/bucket de uploads.
- Migraciones Prisma sobre el mismo schema `public`.
- Monitorear tamaño de `staging_rows` y `verification_items` (`PENDING`).

---

## 10. Checklist rápido para operadores

1. Subir Excel en **Importaciones**.
2. Revisar preview → ajustar **mapeo** → **Procesar**.
3. En resultados, **Enviar a verificación** (no “crear CRM” directo).
4. En **Verificación → Cola**, filtrar y pulsar **Verificar**.
5. Revisar/corregir borrador → **Validar y guardar**.
6. Confirmar Persona/Empresa en el CRM y evento en **Auditoría**.

---

## 11. Variables de entorno relevantes

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | PostgreSQL único |
| `UPLOAD_DIR` | Directorio de archivos Excel |
| `INTAKE_SESSION_TTL_MIN` | TTL de sesión Intake abierta (no de la cola) |
| `WS_PATH` | Path WebSocket (p. ej. `/ws/intake`) |

---

*Última actualización alineada al flujo “staging → verification_items → intake bajo demanda → entities”.*
