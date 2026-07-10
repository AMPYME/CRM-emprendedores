# Explicacion de la base de datos (Prisma Schema)

Este documento explica **todo el modelo de datos** definido en `schema.prisma` para el CRM de Emprendedores.

## 1) Panorama general

La base usa PostgreSQL y Prisma con un modelo orientado a CRM:

- Autenticacion y usuarios internos.
- Entidades de negocio (persona, empresa, establecimiento).
- Contactos y relaciones entre entidades.
- Eventos e inscripciones.
- Cartera/seguimiento de casos.
- Importaciones masivas desde Excel con staging.

El diseno principal aplica un patron **Table-per-Type (TPT)**:

- `Entity` es la tabla maestra/polimorfica.
- `Person`, `Company` y `Establishment` guardan campos especificos por tipo.
- Cada subtipo apunta a `Entity` con `entityId @unique`, forzando relacion 1:1.

---

## 2) Configuracion tecnica de Prisma

- `generator client`: genera Prisma Client JS.
- `binaryTargets = ["native", "debian-openssl-3.0.x"]` para compatibilidad de engine en contenedor Debian.
- `datasource db`: proveedor `postgresql` y conexion por `DATABASE_URL`.

---

## 3) Enums (catalogos de estado/tipo)

Los enums garantizan valores controlados en columnas clave:

- `EntityType`: `PERSON`, `COMPANY`, `ESTABLISHMENT`
- `EntityStatus`: `ACTIVE`, `INACTIVE`, `DUPLICATE`, `MERGED`
- `ContactType`: email, telefonos, whatsapp, web, etc.
- `RelationshipType`: propietario, empleado, socio, sucursal, etc.
- `EventStatus`: borrador/publicado/en curso/completado/cancelado
- `RegistrationStatus`: registrado/confirmado/asistio/no_show/cancelado
- `PortfolioStatus`: nuevo/progreso/espera/resuelto/cerrado
- `PortfolioPriority`: baja/media/alta/urgente
- `ActionType`: llamada, email, visita, reunion, nota, etc.
- `ImportStatus`: pipeline de importacion (pendiente -> procesando -> completado/fallido)
- `StagingRowStatus`: estado por fila importada
- `Gender`: masculino/femenino/otro
- `UserRole`: roles internos de acceso (admin, manager, analyst, operator, viewer)

---

## 4) Modulo: Autenticacion y usuarios

### `User` (`users`)
Representa usuarios internos del sistema (no emprendedores externos).

Campos clave:

- `email` unico.
- `passwordHash` mapeado a `password_hash`.
- `role` con enum `UserRole`.
- `isActive`, `lastLoginAt`, timestamps.

Relaciones:

- Asigna cartera (`PortfolioRecord.assignedToId`).
- Registra acciones de cartera (`PortfolioAction.performedById`).
- Figura como importador (`ImportBatch.importedById`).
- Figura como creador de entidades (`Entity.createdById`).

---

## 5) Modulo central: Entidades maestras (TPT)

### `Entity` (`entities`) - tabla maestra

`Entity` concentra campos comunes de cualquier actor del CRM:

- Tipo (`entityType`) y estado (`status`).
- Nombre de despliegue (`displayName`).
- Ubicacion comun: provincia, distrito, corregimiento, direccion.
- Trazabilidad: `sourceOrigin`, `importBatchId`, `createdById`.
- Fusion de duplicados: `mergedIntoId` (self relation).

Relaciones principales:

- 1:1 opcional a subtipo: `person`, `company`, `establishment`.
- 1:N a `EntityContact`.
- N:N dirigida via tabla puente `EntityRelationship`.
- 1:N a `EventRegistration`.
- 1:N a `PortfolioRecord`.
- 1:N inversa desde `StagingRow` como entidad sugerida/matcheada.

Indices en `entityType`, `status`, `displayName`, `province`, `sourceOrigin`, `importBatchId`.

### `Person` (`persons`)
Campos de persona natural: cedula, nombres, genero, fecha nacimiento, nivel educativo, ocupacion, etc.

- `entityId @unique`: cada persona corresponde a una sola entidad maestra.
- `onDelete: Cascade`: si borras entidad madre, borra subtipo.

### `Company` (`companies`)
Campos juridicos/empresa: RUC, DV, razon social, nombre comercial, tipo empresa, actividad economica, etc.

- Tambien usa `entityId @unique` y cascade.

### `Establishment` (`establishments`)
Campos de local/establecimiento: nombre del local, tipo, aviso de operacion, lat/lon.

- Tambien usa `entityId @unique` y cascade.

**Interpretacion funcional del bloque que preguntaste (`Entity`)**:

- Es el "nodo central" para todo el CRM.
- Define datos transversales y llaves de trazabilidad.
- No compite con `Person/Company/Establishment`; los complementa.
- Permite consultas unificadas sin saber el subtipo desde el inicio.

---

## 6) Modulo: Contactos y relaciones entre entidades

### `EntityContact` (`entity_contacts`)

Guarda multiples contactos por entidad:

- tipo (`contactType`), valor (`contactValue`)
- etiqueta opcional (`label`)
- banderas `isPrimary` e `isVerified`

Indices para busquedas por entidad y por valor de contacto.

### `EntityRelationship` (`entity_relationships`)

Modela relaciones dirigidas entre entidades:

- `fromEntityId` -> `toEntityId`
- `relationshipType` + `role` opcional
- rango temporal (`startDate`, `endDate`) + `isActive`

Restriccion importante:

- `@@unique([fromEntityId, toEntityId, relationshipType])`
  evita duplicar la misma relacion tipificada entre dos nodos.

---

## 7) Modulo: Eventos e inscripciones

### `Event` (`events`)

Define ferias/talleres/cumbres:

- nombre, slug unico, estado, fechas, ubicacion.
- `formFields` JSON para formulario dinamico por evento.

### `EventRegistration` (`event_registrations`)

Inscripcion de una `Entity` a un `Event`.

- Estado de asistencia (`RegistrationStatus`).
- Fechas de registro/confirmacion/asistencia.
- Trazabilidad de importacion (`sourceOrigin`, `importBatchId`).

Restriccion clave:

- `@@unique([eventId, entityId])`:
  una entidad no puede registrarse dos veces al mismo evento.

### `EventRegistrationAnswer` (`event_registration_answers`)

Guarda respuestas a campos dinamicos:

- `fieldKey`, `fieldLabel`, `value`.
- Unicidad por `registrationId + fieldKey`.

---

## 8) Modulo: Cartera y seguimiento

### `PortfolioRecord` (`portfolio_records`)

Caso/gestion de seguimiento para una entidad:

- estado y prioridad (enums).
- categoria, asunto, descripcion.
- fechas de seguimiento/cierre.
- asignacion opcional a usuario interno.

### `PortfolioAction` (`portfolio_actions`)

Bitacora de acciones dentro de un caso:

- tipo de accion (`ActionType`), descripcion y resultado.
- fecha accion y proximos pasos.
- quien la realizo (`performedById`).

Modelo resultante:

- 1 caso (`PortfolioRecord`) tiene muchas acciones (`PortfolioAction`).

---

## 9) Modulo: Importaciones masivas

### `ImportBatch` (`import_batches`)

Cabecera del proceso de carga:

- nombre archivo, tipo fuente, estado pipeline.
- metricas agregadas (total/validas/invalidas/duplicadas/importadas).
- `errorLog` y `columnMapping` en JSON.
- `importedById`, timestamps de inicio/fin.

Relaciona lo importado con:

- entidades creadas,
- registros a eventos,
- filas staging.

### `StagingRow` (`staging_rows`)

Detalle fila a fila antes de persistencia final:

- `rawData` JSON con la fila cruda.
- campos extraidos para matching (cedula, ruc, email, etc.).
- resultado de validacion (`validationErrors`), score y razon de match.
- `matchedEntityId` para deduplicacion asistida.

Idea de arquitectura:

- primero cae en staging,
- luego se valida/deduplica,
- finalmente se crea o actualiza datos maestros.

---

## 10) Convenciones de diseno observadas

- Uso sistematico de `@map(...)` para mantener nombres SQL en snake_case y nombres TS en camelCase.
- `@updatedAt` en tablas principales para auditoria de cambios.
- `@default(uuid())` como PK en casi todas las tablas.
- `onDelete: Cascade` en relaciones dependientes para mantener integridad.
- Indices en columnas de consulta operativa (estado, nombres, llaves de busqueda).

---

## 11) Relaciones clave resumidas

- `User` 1:N `PortfolioRecord` (asignado a)
- `User` 1:N `PortfolioAction` (accion realizada por)
- `User` 1:N `ImportBatch` (importado por)
- `User` 1:N `Entity` (creado por)

- `Entity` 1:1 `Person | Company | Establishment`
- `Entity` 1:N `EntityContact`
- `Entity` N:N `Entity` via `EntityRelationship`
- `Entity` 1:N `EventRegistration`
- `Entity` 1:N `PortfolioRecord`
- `Entity` self relation de merge (`mergedInto` / `mergedFrom`)

- `Event` 1:N `EventRegistration`
- `EventRegistration` 1:N `EventRegistrationAnswer`

- `ImportBatch` 1:N `StagingRow`
- `ImportBatch` 1:N `Entity`
- `ImportBatch` 1:N `EventRegistration`

---

## 12) Como leer esta BD en terminos de negocio

1. **Captura de datos**: manual o importacion (`ImportBatch` + `StagingRow`).
2. **Normalizacion**: todo actor se vuelve `Entity` + subtipo TPT.
3. **Enriquecimiento**: contactos, relaciones, cartera y eventos.
4. **Operacion CRM**: seguimiento por casos (`PortfolioRecord`) y bitacora (`PortfolioAction`).
5. **Trazabilidad**: `sourceOrigin`, `importBatchId`, `createdById`, timestamps y estados.

---

## 13) Consultas tipicas habilitadas por el modelo

- Buscar entidades por nombre/ubicacion/estado.
- Ver red de relaciones de una entidad.
- Ver todos los eventos de una entidad y su estado de asistencia.
- Ver cartera activa por analista/operador y proximos seguimientos.
- Auditar calidad de importacion por lote y por fila.
- Resolver duplicados con `mergedInto` y `matchScore`.

---

## 14) Conclusiones tecnicas

El schema esta bien orientado a un CRM con alta trazabilidad y cargas masivas:

- La separacion `Entity` + subtipos mantiene flexibilidad y orden.
- Los enums e indices ayudan a consistencia y rendimiento.
- El bloque de importacion/staging permite controlar calidad de datos antes de persistir definitivamente.
- El bloque de cartera/eventos convierte la base en un sistema de operacion, no solo de almacenamiento.
