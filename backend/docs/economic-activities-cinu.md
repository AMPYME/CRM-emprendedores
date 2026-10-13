# Módulo de actividades económicas — CINU 4.1

Clasificación de actividades económicas de personas y empresas del CRM Emprendedores AMPYME, basada en el catálogo oficial CINU 4.1 de Panamá.

## Arquitectura

- Catálogo versionado en PostgreSQL (`cinu_versions` + 5 niveles jerárquicos).
- Relación operativa `entity_economic_activities` sobre la entidad maestra `Entity` (TPT: `Person` / `Company`).
- La API **no** hace DML directo sobre las tablas del módulo: solo invoca `api.fn_*` (`SECURITY DEFINER`, `search_path` acotado).
- Soft-delete obligatorio; no hay borrado físico de actividades.
- Auditoría vía `audit_logs` (acción CREATE/UPDATE/DELETE, `entity_type = ECONOMIC_ACTIVITY`).

## Tablas

| Tabla | Rol |
| --- | --- |
| `cinu_versions` | Versión del clasificador (p. ej. `CINU-4.1`) |
| `cinu_categories` | Categoría (código letra) |
| `cinu_divisions` | División (2 dígitos) |
| `cinu_groups` | Grupo (3 dígitos) |
| `cinu_classes` | Clase (4 dígitos) |
| `cinu_subclasses` | Subclase opcional (5 dígitos) |
| `entity_economic_activities` | Actividades asignadas a una entidad |

Códigos almacenados como `VARCHAR` (conservan ceros iniciales).

## Importación del catálogo

```bash
cd backend
npm run import:cinu
# o con ruta explícita:
npm run import:cinu -- /ruta/cinu_4_1_jerarquico.json
```

El proceso es **idempotente** (upsert por versión + código), valida jerarquía/duplicados y genera un reporte JSON de validación junto al archivo fuente. Textos incompletos se conservan y se reportan como advertencias.

## Endpoints REST (`/api/v1`)

### Catálogo

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/economic-activities/categories` | Categorías de la versión activa (`?version_code=` opcional) |
| GET | `/economic-activities/divisions?category_id=` | Divisiones de una categoría |
| GET | `/economic-activities/groups?division_id=` | Grupos de una división |
| GET | `/economic-activities/classes?group_id=` | Clases de un grupo |
| GET | `/economic-activities/subclasses?class_id=` | Subclases de una clase |
| GET | `/economic-activities/search?q=` | Búsqueda por código/nombre (mín. 2 caracteres) |

### Actividades de entidad

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/entities/:entityId/economic-activities` | Lista actividades activas |
| POST | `/entities/:entityId/economic-activities` | Asigna actividad (`cinuClassId`, `cinuSubclassId?`, `isPrimary?`) |
| PATCH | `/entities/:entityId/economic-activities/:activityId` | Marca como principal (`{ "isPrimary": true }`) |
| DELETE | `/entities/:entityId/economic-activities/:activityId` | Eliminación lógica |

Mutaciones requieren autenticación y rol con permiso de escritura.

### Ejemplo POST

```json
{
  "cinuClassId": "uuid-de-clase",
  "cinuSubclassId": null,
  "isPrimary": true
}
```

## Reglas de integridad

1. Varias actividades activas por entidad.
2. Solo una actividad principal activa (`is_primary`) por entidad.
3. Subclase opcional; si existe, debe pertenecer a la clase.
4. Sin duplicados activos (misma clase + subclase).
5. Clase y subclase de la misma versión del catálogo.
6. Sin DELETE físico (trigger + soft-delete middleware).

## Funciones PostgreSQL

Lectura: `fn_get_cinu_categories`, `fn_get_cinu_divisions`, `fn_get_cinu_groups`, `fn_get_cinu_classes`, `fn_get_cinu_subclasses`, `fn_search_economic_activities`, `fn_get_entity_economic_activities`.

Escritura: `fn_assign_entity_economic_activity`, `fn_set_primary_economic_activity`, `fn_remove_entity_economic_activity`.

Importación: `fn_upsert_cinu_version` y `fn_upsert_cinu_*` por nivel.

Rol `crm_api`: EXECUTE sobre funciones públicas del módulo; sin privilegios DML sobre tablas base.

## Pruebas

```bash
npm test -- --testPathPattern=economic-activities
npm run test:db
```

## OpenAPI / Swagger

La documentación operativa de endpoints está en este archivo y en los comentarios JSDoc de:

- `src/modules/economic-activities/economic-activities.controller.ts`
- `src/modules/economic-activities/economic-activities.routes.ts`

El CRM no monta un servidor Swagger UI separado; los contratos siguen el formato estándar `ApiResponse` del proyecto.
