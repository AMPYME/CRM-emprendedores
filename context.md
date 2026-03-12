# Emprendedores CRM — Contexto del Proyecto

> **Última actualización:** 2026-03-10 (FASE 8 — Frontend completo)
> **Estado general:** FASE 8 completada — Frontend completo con todas las páginas, componentes UI, servicios, hooks y wizard de importación

---

## 📋 Descripción General

Sistema CRM/Cartera de emprendedores para **AMPYME** (Autoridad de la Micro, Pequeña y Mediana Empresa — Panamá). Permite gestionar personas, empresas, establecimientos, eventos, cartera de seguimiento e importaciones masivas desde Excel.

FASE 1 - Diseño técnico del proyecto
- Propón estructura de carpetas para backend y frontend.
- Propón arquitectura modular.
- Define módulos: auth, entities, persons, companies, establishments, contacts, events, portfolio, imports.
- Define convenciones de nombres.
- Define validaciones y flujo general.

FASE 2 - Backend base
- Crear proyecto backend en Node.js + TypeScript.
- Configurar conexión PostgreSQL.
- Crear configuración base.
- Crear módulo de salud / healthcheck.
- Crear sistema de manejo de errores.
- Crear logger.
- Crear middlewares básicos.
- Crear sistema base de paginación, filtros y respuestas estándar.

FASE 3 - Base de datos e infraestructura
- Traducir el modelo SQL a migraciones.
- Crear índices necesarios.
- Crear seeds mínimos.
- Crear tabla de usuarios y roles.
- Preparar entorno local con Docker Compose para PostgreSQL.

FASE 4 - CRUD maestro
- Implementar CRUD de entities.
- Implementar CRUD de persons.
- Implementar CRUD de companies.
- Implementar CRUD de establishments.
- Implementar CRUD de entity_contacts.
- Implementar búsqueda por nombre, cédula, RUC, teléfono, correo.
- Implementar filtros por tipo, estado, provincia, actividad económica.

FASE 5 - Eventos
- Implementar CRUD de events.
- Implementar registro de personas a eventos.
- Implementar respuestas variables por evento.
- Permitir que una persona tenga varias participaciones en distintos eventos.
- Preparar estructura para importar eventos desde Excel.

FASE 6 - Cartera / seguimiento
- Implementar portfolio_records.
- Implementar portfolio_actions.
- Permitir asignación de responsable.
- Permitir estado, prioridad, fecha próxima de seguimiento.
- Crear endpoint para ver cartera vencida, próxima y sin gestionar.

FASE 7 - Importaciones
- Diseñar flujo de importación de Excel.
- Crear import_batches.
- Crear staging tables.
- Crear parser para Excel.
- Crear mapeo para base grande de directorio.
- Crear mapeo para bases de eventos.
- Crear estrategia para homologación.
- Crear estrategia básica de deduplicación:
  - por cédula
  - por RUC
  - por email
  - por teléfono
  - por similitud de nombre en casos blandos
- Nunca hacer merge automático agresivo sin revisión.

FASE 8 - Frontend
- Crear dashboard base.
- Crear vista de listado general con filtros.
- Crear formulario de creación y edición para persona, empresa y establecimiento.
- Crear detalle de entidad con pestañas:
  - resumen
  - contactos
  - relaciones
  - eventos
  - cartera
  - gestiones
- Crear módulo de importación de Excel.
- Crear vistas de eventos y cartera.

FASE 9 - Calidad
- Agregar validaciones robustas.
- Agregar pruebas unitarias.
- Agregar pruebas de integración básicas.
- Revisar performance de filtros.
- Revisar índices.
- Proponer mejoras futuras.

---

## 🏗️ Arquitectura

### Stack Tecnológico

| Capa         | Tecnología                   | Versión    |
|--------------|------------------------------|------------|
| **Backend**  | Node.js + Express + TypeScript | Express 4.21, TS 5.6 |
| **ORM**      | Prisma                       | 5.22       |
| **Base de datos** | PostgreSQL              | 16 (Alpine via Docker) |
| **Frontend** | Next.js + React + TypeScript | Next 14.2, React 18.3 |
| **UI**       | Tailwind CSS                 | 3.4        |
| **Estado**   | Zustand                      | 5.0        |
| **Queries**  | TanStack React Query         | 5.59       |
| **Tablas**   | TanStack React Table         | 8.20       |
| **Forms**    | React Hook Form + Zod        | RHF 7.53, Zod 3.23 |
| **HTTP**     | Axios                        | 1.7        |
| **Iconos**   | Lucide React                 | 0.451      |
| **Docker**   | Docker Compose               | 3.8        |

### Puertos

| Servicio   | Puerto |
|------------|--------|
| Frontend   | 3000   |
| Backend    | 4000   |
| PostgreSQL | 55555  |

### Prefijo API

Todas las rutas van bajo: `http://localhost:4000/api/v1`

---

## 📁 Estructura del Proyecto

```
emprendedores/
├── context.md                 ← Este archivo
├── docker-compose.yml         ← PostgreSQL 16 en Docker
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── env.example            ← Variables de entorno (copiar a .env)
│   ├── prisma/
│   │   ├── schema.prisma      ← Modelo de datos completo (549 líneas)
│   │   ├── seed.ts            ← ✅ Seeds (usuarios, personas, empresas, establec., eventos, cartera)
│   │   └── migrations/
│   │       └── 20260310194931_init/  ← ✅ Migración inicial aplicada
│   └── src/
│       ├── server.ts          ← Bootstrap del servidor (con graceful shutdown)
│       ├── app.ts             ← Configuración Express (middlewares, rutas)
│       ├── routes.ts          ← Router principal (monta todos los módulos activos)
│       ├── config/
│       │   ├── database.ts    ← Singleton PrismaClient
│       │   ├── environment.ts ← Configuración tipada desde .env
│       │   └── index.ts
│       ├── modules/
│       │   ├── health/        ← ✅ Health check + DB check
│       │   ├── entities/      ← ✅ Búsqueda cross-type + detalle
│       │   ├── persons/       ← ✅ CRUD completo + deduplicación por cédula
│       │   ├── companies/     ← ✅ CRUD completo
│       │   ├── establishments/← ✅ CRUD completo
│       │   ├── contacts/      ← ✅ CRUD anidado bajo entidad + rutas directas
│       │   ├── events/        ← ✅ CRUD eventos + inscripciones + respuestas dinámicas
│       │   │   ├── event.validator.ts
│       │   │   ├── event.repository.ts
│       │   │   ├── event.service.ts
│       │   │   ├── event.controller.ts
│       │   │   ├── event.routes.ts
│       │   │   ├── registration.validator.ts
│       │   │   ├── registration.repository.ts
│       │   │   ├── registration.service.ts
│       │   │   ├── registration.controller.ts
│       │   │   └── index.ts
│       │   ├── portfolio/     ← ✅ Cartera + acciones + vistas especiales
│       │   │   ├── portfolio.validator.ts
│       │   │   ├── portfolio.repository.ts
│       │   │   ├── portfolio.service.ts
│       │   │   ├── portfolio.controller.ts
│       │   │   ├── portfolio.routes.ts
│       │   │   └── index.ts
│       │   ├── imports/       ← ✅ Importaciones masivas Excel (upload, staging, validación, deduplicación, import)
│       │   │   ├── import.types.ts
│       │   │   ├── import.validator.ts
│       │   │   ├── import.repository.ts
│       │   │   ├── import.service.ts
│       │   │   ├── import.controller.ts
│       │   │   ├── import.routes.ts
│       │   │   ├── upload.middleware.ts
│       │   │   ├── parser.service.ts
│       │   │   ├── mapper.service.ts
│       │   │   ├── dedup.service.ts
│       │   │   └── index.ts
│       │   ├── auth/          ← ✅ Login, registro, JWT, refresh, cambio de contraseña, perfil, middlewares protect+authorize
│       │   └── relationships/ ← ✅ Relaciones entre entidades (persona→empresa, persona→establecimiento, empresa→establecimiento)
│       └── shared/
│           ├── errors/        ← AppError, NotFoundError, ValidationError, ConflictError, etc.
│           ├── logger/        ← Winston logger
│           ├── middlewares/
│           │   ├── error-handler.ts  ← Manejo centralizado de errores
│           │   ├── not-found.ts      ← 404 para rutas no encontradas
│           │   └── validate.middleware.ts  ← ✅ Middleware de validación con Zod
│           ├── state/         ← Estado global de la app (BD conectada, etc.)
│           ├── types/
│           │   ├── api-response.types.ts  ← ApiResponse, PaginationMeta, PaginatedResult
│           │   ├── entity.types.ts        ← ✅ Tipos Prisma derivados + includes reutilizables
│           │   ├── enums.ts               ← Enums del dominio
│           │   └── index.ts
│           └── utils/
│               ├── response.utils.ts   ← sendSuccess, sendPaginated, sendError
│               ├── pagination.utils.ts ← parsePaginationParams, buildPaginationMeta
│               ├── string.utils.ts     ← normalizeText, normalizeCedula, normalizeRuc, titleCase
│               ├── async-handler.ts    ← ✅ Wrapper async para Express (captura errores)
│               └── index.ts
│
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── next.config.js
    ├── tailwind.config.ts
    ├── postcss.config.js
    └── src/
        ├── app/
        │   ├── layout.tsx              ← Layout raíz con Providers
        │   ├── page.tsx                ← Redirect a /dashboard
        │   ├── globals.css             ← Estilos globales Tailwind
        │   ├── providers.tsx           ← ✅ QueryClientProvider + Toaster
        │   ├── (auth)/
        │   │   ├── layout.tsx          ← ✅ Layout de auth (centrado, sin sidebar)
        │   │   └── login/
        │   │       └── page.tsx        ← ✅ Página de login con JWT
        │   └── (dashboard)/
        │       ├── layout.tsx          ← ✅ Layout con Sidebar + Header + AuthGuard
        │       └── dashboard/
        │           ├── page.tsx        ← ✅ Dashboard con stats cards + resumen cartera
        │           ├── persons/
        │           │   ├── page.tsx           ← ✅ Listado con búsqueda, filtros, paginación
        │           │   ├── person-form-modal.tsx ← ✅ Modal crear/editar persona
        │           │   └── [id]/page.tsx      ← ✅ Detalle persona (EntityDetail)
        │           ├── companies/
        │           │   ├── page.tsx           ← ✅ Listado con búsqueda, filtros, paginación
        │           │   ├── company-form-modal.tsx ← ✅ Modal crear/editar empresa
        │           │   └── [id]/page.tsx      ← ✅ Detalle empresa (EntityDetail)
        │           ├── establishments/
        │           │   ├── page.tsx           ← ✅ Listado con búsqueda, filtros, paginación
        │           │   ├── establishment-form-modal.tsx ← ✅ Modal crear/editar establecimiento
        │           │   └── [id]/page.tsx      ← ✅ Detalle establecimiento (EntityDetail)
        │           ├── events/
        │           │   ├── page.tsx           ← ✅ Listado con búsqueda, filtros, crear evento
        │           │   └── [id]/page.tsx      ← ✅ Detalle evento + inscripciones + editar
        │           ├── portfolio/
        │           │   ├── page.tsx           ← ✅ Listado cartera con filtros de estado/prioridad
        │           │   └── [id]/page.tsx      ← ✅ Detalle caso + acciones + editar
        │           └── imports/
        │               ├── page.tsx           ← ✅ Listado importaciones + subir archivo
        │               └── [id]/page.tsx      ← ✅ Wizard de importación (preview → mapping → process → review)
        ├── components/
        │   ├── entities/
        │   │   └── entity-detail.tsx  ← ✅ Componente reutilizable con tabs (resumen, contactos, relaciones, eventos, cartera)
        │   ├── layout/
        │   │   ├── sidebar.tsx        ← ✅ Sidebar con navegación y logo
        │   │   ├── header.tsx         ← ✅ Header con usuario y logout
        │   │   ├── page-header.tsx    ← ✅ Encabezado de página con breadcrumbs
        │   │   └── index.ts           ← Re-exports
        │   └── ui/
        │       ├── badge.tsx          ← ✅ Badge con variantes (default, primary, success, warning, danger, info, purple)
        │       ├── button.tsx         ← ✅ Button con variantes, tamaños, loading, icon
        │       ├── card.tsx           ← ✅ Card, CardHeader, CardContent, CardFooter, StatCard (soporta title/description)
        │       ├── data-table.tsx     ← ✅ Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell
        │       ├── table.ts           ← ✅ Re-export de data-table para import alias
        │       ├── empty-state.tsx    ← ✅ EmptyState con icon (ElementType), title, description, action
        │       ├── input.tsx          ← ✅ Input con label, error, helper text
        │       ├── select.tsx         ← ✅ Select con label, error, opciones
        │       ├── modal.tsx          ← ✅ Modal con title, description, footer, tamaños (sm/md/lg/xl)
        │       ├── pagination.tsx     ← ✅ Pagination con currentPage/totalPages
        │       ├── search-bar.tsx     ← ✅ SearchBar con onSearch, debounce, initialQuery
        │       ├── tabs.tsx           ← ✅ Tabs con TabList, Tab, TabPanels, TabPanel
        │       ├── loading-spinner.tsx← ✅ Spinner de carga
        │       └── index.ts          ← Re-exports de todos los UI components
        ├── hooks/
        │   ├── use-auth.ts           ← ✅ Hook de autenticación (login, logout, guard)
        │   ├── use-pagination.ts     ← ✅ Hook de paginación (page, limit, search, filters)
        │   ├── use-persons.ts        ← ✅ React Query hooks para personas
        │   ├── use-companies.ts      ← ✅ React Query hooks para empresas
        │   ├── use-establishments.ts ← ✅ React Query hooks para establecimientos
        │   ├── use-entities.ts       ← ✅ React Query hooks para entidades
        │   ├── use-events.ts         ← ✅ React Query hooks para eventos + inscripciones
        │   ├── use-portfolio.ts      ← ✅ React Query hooks para cartera + acciones
        │   └── use-imports.ts        ← ✅ React Query hooks para importaciones + staging rows
        ├── stores/
        │   └── auth.store.ts         ← ✅ Zustand store para JWT tokens + user state
        ├── services/
        │   ├── api-client.ts         ← ✅ Axios con interceptores JWT (auto-refresh)
        │   ├── auth.service.ts       ← ✅ Login, register, refresh, profile, change-password
        │   ├── persons.service.ts    ← ✅ CRUD personas
        │   ├── companies.service.ts  ← ✅ CRUD empresas
        │   ├── establishments.service.ts ← ✅ CRUD establecimientos
        │   ├── entities.service.ts   ← ✅ Búsqueda cross-type + detalle
        │   ├── contacts.service.ts   ← ✅ CRUD contactos
        │   ├── events.service.ts     ← ✅ CRUD eventos + inscripciones
        │   ├── portfolio.service.ts  ← ✅ CRUD cartera + acciones
        │   ├── imports.service.ts    ← ✅ Upload, preview, mapping, process, execute, rows, resolve
        │   └── index.ts             ← Re-exports
        ├── lib/
        │   └── utils.ts              ← Utilidades (cn para clsx/tailwind-merge)
        └── types/
            ├── api.types.ts          ← Tipos de respuesta API (ApiResponse, PaginationMeta, PaginatedResult)
            ├── entities.types.ts     ← Tipos de dominio (Entity, Person, Company, Establishment, etc.)
            ├── auth.types.ts         ← ✅ Tipos de auth (User, LoginInput, LoginResponse, etc.)
            └── index.ts
```

---

## 🗄️ Modelo de Datos (Prisma Schema)

### Patrón: Table-per-Type (TPT)

La tabla `Entity` es la **tabla maestra polimórfica**. Cada entidad es una persona, empresa o establecimiento, con datos comunes en `Entity` y datos específicos en tablas hijas.

### Migración

- **Migración inicial aplicada:** `20260310194931_init`
- Crea todas las tablas, enums, índices y foreign keys del schema completo
- Estado: ✅ Aplicada exitosamente

### Modelos Principales

| Modelo                    | Descripción                                       |
|---------------------------|---------------------------------------------------|
| `User`                    | Usuarios del sistema con roles (ADMIN, MANAGER, ANALYST, OPERATOR, VIEWER) |
| `Entity`                  | Tabla maestra polimórfica (persona/empresa/establecimiento) |
| `Person`                  | Datos de persona natural (cédula, nombre, datos laborales) |
| `Company`                 | Datos de persona jurídica (RUC, DV, razón social) |
| `Establishment`           | Datos de local comercial (nombre, tipo, coordenadas GPS) |
| `EntityContact`           | Contactos de una entidad (email, teléfono, WhatsApp, web) |
| `EntityRelationship`      | Relaciones entre entidades (dueño, empleado, socio, sucursal) |
| `Event`                   | Eventos (ferias, capacitaciones, talleres) con formularios dinámicos (JSON) |
| `EventRegistration`       | Inscripción de entidad a evento |
| `EventRegistrationAnswer` | Respuestas a campos dinámicos de formulario de evento |
| `PortfolioRecord`         | Registro de cartera/seguimiento asignado a un usuario |
| `PortfolioAction`         | Acción/gestión realizada sobre un caso de cartera |
| `ImportBatch`             | Lote de importación desde Excel |
| `StagingRow`              | Fila individual de Excel en staging (validación + dedup) |

### Enums del Sistema

| Enum                | Valores |
|---------------------|---------|
| `EntityType`        | PERSON, COMPANY, ESTABLISHMENT |
| `EntityStatus`      | ACTIVE, INACTIVE, DUPLICATE, MERGED |
| `ContactType`       | EMAIL, PHONE, MOBILE, WHATSAPP, WEBSITE, SOCIAL_MEDIA, OTHER |
| `RelationshipType`  | OWNER, EMPLOYEE, PARTNER, BRANCH, REPRESENTATIVE, OTHER |
| `EventStatus`       | DRAFT, PUBLISHED, IN_PROGRESS, COMPLETED, CANCELLED |
| `RegistrationStatus`| REGISTERED, CONFIRMED, ATTENDED, NO_SHOW, CANCELLED |
| `PortfolioStatus`   | NEW, IN_PROGRESS, WAITING, RESOLVED, CLOSED |
| `PortfolioPriority` | LOW, MEDIUM, HIGH, URGENT |
| `ActionType`        | CALL, EMAIL_ACTION, VISIT, MEETING, WHATSAPP, NOTE, DOCUMENT, STATUS_CHANGE, OTHER |
| `ImportStatus`      | PENDING, PROCESSING, VALIDATING, DEDUPLICATING, REVIEW_REQUIRED, IMPORTING, COMPLETED, FAILED, CANCELLED |
| `StagingRowStatus`  | PENDING, VALID, INVALID, DUPLICATE_EXACT, DUPLICATE_POSSIBLE, IMPORTED, SKIPPED, ERROR |
| `Gender`            | MALE, FEMALE, OTHER |
| `UserRole`          | ADMIN, MANAGER, ANALYST, OPERATOR, VIEWER |

---

## 🌱 Seeds (Datos Iniciales)

El archivo `prisma/seed.ts` crea datos de ejemplo para desarrollo:

### Usuarios

| Email                   | Rol      | Contraseña   |
|-------------------------|----------|--------------|
| admin@ampyme.gob.pa     | ADMIN    | Admin2026!   |
| operador@ampyme.gob.pa  | OPERATOR | Operador2026!|

### Personas (3)

| Nombre                  | Cédula      | Provincia | Negocio                | Contactos |
|-------------------------|-------------|-----------|------------------------|-----------|
| María González Rodríguez| 8-900-1234  | Panamá    | Artesanías María       | Email + Móvil |
| Carlos Mendoza          | 4-200-5678  | Chiriquí  | Finca Mendoza          | Móvil + Email |
| Ana Lucía Vega          | *(sin cédula)* | Veraguas | Confecciones Vega     | WhatsApp |

### Empresas (2)

| Nombre                         | RUC             | Provincia | Tipo        |
|--------------------------------|-----------------|-----------|-------------|
| Innovación Digital S.A.        | 155600-1-12345  | Panamá    | SA          |
| Cooperativa Agrícola de Chiriquí | *(sin RUC)*   | Chiriquí  | Cooperativa |

### Establecimientos (2)

| Nombre                              | Provincia | Tipo             | GPS        |
|--------------------------------------|-----------|------------------|------------|
| Panadería El Buen Pan - Vía España  | Panamá    | Local comercial  | 9.0055, -79.5196 |
| Minisuper Don Pepe - Santiago        | Veraguas  | Minisuper        | *(sin GPS)* |

### Relaciones (2)

- María González → Innovación Digital S.A. (EMPLOYEE, Gerente de Proyectos)
- Carlos Mendoza → Panadería El Buen Pan (OWNER)

### Eventos (3)

| Nombre                              | Tipo          | Estado     | Provincia | Capacidad | Formulario dinámico |
|--------------------------------------|---------------|------------|-----------|-----------|---------------------|
| Feria del Emprendedor 2026          | Feria         | PUBLISHED  | Panamá    | 500       | standSize, productCategory, needsElectricity |
| Capacitación en Marketing Digital   | Capacitación  | PUBLISHED  | Panamá    | 40        | businessType, experienceLevel |
| Cumbre PYME Chiriquí 2026           | Cumbre        | DRAFT      | Chiriquí  | 200       | *(sin formulario)* |

### Inscripciones a Eventos (5)

| Entidad                        | Evento                             | Estado     | Respuestas |
|--------------------------------|------------------------------------|------------|------------|
| María González Rodríguez       | Feria del Emprendedor 2026         | CONFIRMED  | 3          |
| Innovación Digital S.A.        | Feria del Emprendedor 2026         | REGISTERED | 3          |
| María González Rodríguez       | Capacitación en Marketing Digital  | ATTENDED   | 2          |
| Carlos Mendoza                 | Capacitación en Marketing Digital  | CONFIRMED  | 2          |
| Ana Lucía Vega                 | Capacitación en Marketing Digital  | NO_SHOW    | 2          |

### Registros de Cartera (5)

| Entidad                         | Asunto                                           | Estado      | Prioridad | Categoría           | Responsable  | Acciones |
|----------------------------------|--------------------------------------------------|-------------|-----------|---------------------|--------------|----------|
| María González Rodríguez        | Solicitud de crédito para ampliación de taller   | IN_PROGRESS | HIGH      | Financiamiento      | Operador     | 2 (CALL, EMAIL) |
| Carlos Mendoza                  | Asesoría en buenas prácticas agrícolas           | NEW         | MEDIUM    | Asistencia Técnica  | *(sin asignar)* | 0 — unmanaged |
| Innovación Digital S.A.         | Actualización de datos de RUC en sistema         | RESOLVED    | LOW       | Registro Empresarial| Admin        | 2 (MEETING, STATUS_CHANGE) |
| Cooperativa Agrícola de Chiriquí| Programa de capacitación grupal pendiente        | WAITING     | URGENT    | Capacitación        | Operador     | 1 (VISIT) — overdue |
| Ana Lucía Vega                  | Apoyo para registro de aviso de operación        | IN_PROGRESS | MEDIUM    | Formalización       | Operador     | 1 (WHATSAPP) — upcoming |

---

## 🔧 Configuración del Backend

### Variables de Entorno (env.example)

- `NODE_ENV` = development
- `PORT` = 4000
- `API_PREFIX` = /api/v1
- `DATABASE_URL` = postgresql://postgres:postgres@localhost:5432/emprendedores_db
- `JWT_SECRET` / `JWT_EXPIRES_IN` (24h) / `JWT_REFRESH_EXPIRES_IN` (7d)
- `CORS_ORIGIN` = http://localhost:3000 (puede ser lista separada por comas, ej. `http://localhost:3000,http://192.168.99.60:3000`)
- `LOG_LEVEL` = debug
- `UPLOAD_DIR` = ./uploads
- `MAX_FILE_SIZE_MB` = 10
- Rate limiting: 100 requests / 15 min

### Middlewares Globales Configurados

1. **Helmet** — Headers de seguridad
2. **CORS** — Permite frontend en :3000
3. **Rate Limit** — 100 req/15min
4. **JSON Parser** — Hasta 10mb
5. **URL Encoded Parser** — Hasta 10mb
6. **Compression** — gzip
7. **Morgan** — Logging HTTP (excepto en tests)
8. **Error Handler** — Manejo centralizado de errores
9. **Not Found Handler** — 404 para rutas no encontradas

### Formato de Respuesta API Estándar

```typescript
{
  success: boolean;
  data: T;
  meta?: { page, limit, total, totalPages, hasNextPage, hasPrevPage };
  error?: { code: string, message: string, details?: object };
}
```

### Errores Predefinidos

| Clase              | HTTP | Código           |
|--------------------|------|------------------|
| `AppError`         | 500  | INTERNAL_ERROR   |
| `NotFoundError`    | 404  | NOT_FOUND        |
| `ValidationError`  | 400  | VALIDATION_ERROR |
| `UnauthorizedError`| 401  | UNAUTHORIZED     |
| `ForbiddenError`   | 403  | FORBIDDEN        |
| `ConflictError`    | 409  | CONFLICT         |
| `BadRequestError`  | 400  | BAD_REQUEST      |

---

## 🌐 Endpoints Activos

### Health

| Método | Ruta                    | Descripción                    |
|--------|-------------------------|--------------------------------|
| GET    | `/api/v1/health`        | Health check del servidor      |
| GET    | `/api/v1/health/db`     | Health check de base de datos  |

### Entities (búsqueda cross-type)

| Método | Ruta                     | Descripción                                    | Validación |
|--------|--------------------------|-------------------------------------------------|------------|
| GET    | `/api/v1/entities`       | Listado paginado con búsqueda cross-type       | `entityQuerySchema` (query) |
| GET    | `/api/v1/entities/:id`   | Detalle completo de una entidad (cualquier tipo)| `entityIdParamSchema` (params) |

**Filtros de búsqueda cross-type:** `page`, `limit`, `sortBy` (displayName, createdAt, updatedAt, province), `sortOrder`, `search`, `entityType`, `status`, `province`

**Búsqueda `search`** busca en: displayName, cédula, firstName, lastName, businessName, RUC, legalName, tradeName, establishmentName, contactValue.

### Relationships (Relaciones entre entidades)

| Método | Ruta                                          | Descripción                                             | Validación |
|--------|-----------------------------------------------|---------------------------------------------------------|------------|
| GET    | `/api/v1/entities/:entityId/relationships`    | Lista relaciones de una entidad (origen, destino o ambas) | `entityIdParamSchema` (params) + `relationshipQuerySchema` (query) |
| POST   | `/api/v1/entities/:entityId/relationships`    | Crea relación desde una entidad hacia otra             | `entityIdParamSchema` (params) + `createRelationshipSchema` (body) |
| PUT    | `/api/v1/relationships/:id`                   | Actualiza una relación existente                        | `relationshipIdParamSchema` (params) + `updateRelationshipSchema` (body) |
| DELETE | `/api/v1/relationships/:id`                   | Marca una relación como inactiva (soft delete)         | `relationshipIdParamSchema` (params) |

**Parámetros de consulta (`relationshipQuerySchema`)** en `GET /entities/:entityId/relationships`:

- `direction` — `'from' | 'to' | 'both'` (por defecto: `from`). Controla si se listan relaciones donde la entidad es origen, destino o ambas.
- `relationshipType` — filtra por tipo de relación (`OWNER`, `EMPLOYEE`, `PARTNER`, `BRANCH`, `REPRESENTATIVE`, `OTHER`).
- `targetEntityType` — filtra por tipo de entidad destino cuando `direction` es `from` o `to` (`PERSON`, `COMPANY`, `ESTABLISHMENT`).
- `isActive` — filtra por relaciones activas/inactivas.

**Lógica de negocio (Relationships):**

- Usa el modelo `EntityRelationship` con claves foráneas `fromEntityId` (origen) y `toEntityId` (destino).
- Constraint único: no se puede repetir la misma combinación `(fromEntityId, toEntityId, relationshipType)` (`ConflictError 409` en caso de duplicado).
- Validación de integridad: se verifica que existan las entidades origen y destino (`NotFoundError 404` si no existen).
- Soft delete: `DELETE /relationships/:id` marca `isActive = false` y setea `endDate` con la fecha actual.
- Se impide crear relaciones de una entidad consigo misma.

### Persons (CRUD completo)

| Método | Ruta                     | Descripción                     | Validación |
|--------|--------------------------|---------------------------------|------------|
| GET    | `/api/v1/persons`        | Listado paginado con filtros    | `personQuerySchema` (query) |
| GET    | `/api/v1/persons/:id`    | Detalle de persona por entity ID| `entityIdParamSchema` (params) |
| POST   | `/api/v1/persons`        | Crear persona nueva             | `createPersonSchema` (body) |
| PUT    | `/api/v1/persons/:id`    | Actualizar persona              | `entityIdParamSchema` (params) + `updatePersonSchema` (body) |
| DELETE | `/api/v1/persons/:id`    | Soft delete (marca INACTIVE)    | `entityIdParamSchema` (params) |

**Filtros específicos de personas:** `search`, `status`, `province`, `cedula`, `gender`, `economicActivity`

**Lógica de negocio:**
- `displayName` se genera automáticamente con `titleCase(firstName lastName secondLastName)`
- Deduplicación por cédula en creación y actualización (lanza `ConflictError 409`)
- Soft delete: cambia status a INACTIVE (no elimina registros)
- Contactos opcionales se crean junto con la persona en un solo POST

### Companies (CRUD completo)

| Método | Ruta                      | Descripción                    | Validación |
|--------|---------------------------|--------------------------------|------------|
| GET    | `/api/v1/companies`       | Listado paginado con filtros   | `companyQuerySchema` (query) |
| GET    | `/api/v1/companies/:id`   | Detalle de empresa             | `entityIdParamSchema` (params) |
| POST   | `/api/v1/companies`       | Crear empresa nueva            | `createCompanySchema` (body) |
| PUT    | `/api/v1/companies/:id`   | Actualizar empresa             | `entityIdParamSchema` (params) + `updateCompanySchema` (body) |
| DELETE | `/api/v1/companies/:id`   | Soft delete (marca INACTIVE)   | `entityIdParamSchema` (params) |

**Filtros específicos de empresas:** `search`, `status`, `province`, `ruc`, `companyType`, `economicActivity`

### Establishments (CRUD completo)

| Método | Ruta                            | Descripción                        | Validación |
|--------|---------------------------------|------------------------------------|------------|
| GET    | `/api/v1/establishments`        | Listado paginado con filtros       | `establishmentQuerySchema` (query) |
| GET    | `/api/v1/establishments/:id`    | Detalle de establecimiento         | `entityIdParamSchema` (params) |
| POST   | `/api/v1/establishments`        | Crear establecimiento nuevo        | `createEstablishmentSchema` (body) |
| PUT    | `/api/v1/establishments/:id`    | Actualizar establecimiento         | `entityIdParamSchema` (params) + `updateEstablishmentSchema` (body) |
| DELETE | `/api/v1/establishments/:id`    | Soft delete (marca INACTIVE)       | `entityIdParamSchema` (params) |

**Filtros específicos de establecimientos:** `search`, `status`, `province`, `establishmentType`, `economicActivity`

### Contacts (CRUD anidado + directo)

| Método | Ruta                                           | Descripción                          | Validación |
|--------|-------------------------------------------------|--------------------------------------|------------|
| GET    | `/api/v1/entities/:entityId/contacts`          | Lista contactos de una entidad       | `entityIdParamSchema` (params) |
| POST   | `/api/v1/entities/:entityId/contacts`          | Crear contacto para una entidad      | `entityIdParamSchema` (params) + `createContactSchema` (body) |
| PUT    | `/api/v1/contacts/:id`                          | Actualizar un contacto               | `contactIdParamSchema` (params) + `updateContactSchema` (body) |
| DELETE | `/api/v1/contacts/:id`                          | Eliminar contacto (hard delete)      | `contactIdParamSchema` (params) |

**Nota:** Los contactos usan rutas anidadas para listar/crear (necesitan entityId) y rutas directas para actualizar/eliminar (solo necesitan contactId).

### Events (CRUD completo — FASE 5)

| Método | Ruta                     | Descripción                    | Validación |
|--------|--------------------------|--------------------------------|------------|
| GET    | `/api/v1/events`         | Listado paginado con filtros   | `eventQuerySchema` (query) |
| GET    | `/api/v1/events/:id`     | Detalle de evento por ID       | `eventIdParamSchema` (params) |
| POST   | `/api/v1/events`         | Crear evento nuevo             | `createEventSchema` (body) |
| PUT    | `/api/v1/events/:id`     | Actualizar evento              | `eventIdParamSchema` (params) + `updateEventSchema` (body) |
| DELETE | `/api/v1/events/:id`     | Eliminar evento (hard delete)  | `eventIdParamSchema` (params) |

**Filtros de eventos:** `search`, `status` (DRAFT, PUBLISHED, IN_PROGRESS, COMPLETED, CANCELLED), `eventType`, `province`, `sortBy` (name, startDate, createdAt, status)

**Lógica de negocio:**
- **Slug automático**: se genera a partir del nombre del evento con `slugify()` (ej: "Feria del Emprendedor 2026" → `feria-del-emprendedor-2026`). Si hay colisión, se agrega sufijo numérico (-2, -3, etc.)
- **Formulario dinámico (`formFields`)**: JSON libre que define campos adicionales del formulario de inscripción. Cada campo tiene `key`, `label`, `type`, `required`, `options`, `placeholder`
- **Validación de fechas**: `endDate` debe ser posterior a `startDate`
- **Capacidad máxima (`maxCapacity`)**: entero positivo opcional

### Event Registrations (Inscripciones — FASE 5)

| Método | Ruta                                               | Descripción                          | Validación |
|--------|-----------------------------------------------------|--------------------------------------|------------|
| GET    | `/api/v1/events/:eventId/registrations`             | Listar inscripciones de un evento    | `eventIdParamSchema` (params) + `registrationQuerySchema` (query) |
| POST   | `/api/v1/events/:eventId/registrations`             | Inscribir entidad a un evento        | `eventIdParamSchema` (params) + `createRegistrationSchema` (body) |
| GET    | `/api/v1/entities/:entityId/registrations`          | Listar inscripciones de una entidad  | `entityIdParamSchema` (params) + `registrationQuerySchema` (query) |
| GET    | `/api/v1/registrations/:id`                         | Detalle de una inscripción           | `registrationIdParamSchema` (params) |
| PUT    | `/api/v1/registrations/:id`                         | Actualizar inscripción               | `registrationIdParamSchema` (params) + `updateRegistrationSchema` (body) |
| DELETE | `/api/v1/registrations/:id`                         | Eliminar inscripción (hard delete)   | `registrationIdParamSchema` (params) |

**Filtros de inscripciones:** `search`, `status` (REGISTERED, CONFIRMED, ATTENDED, NO_SHOW, CANCELLED), `sortBy` (registeredAt, status, createdAt)

**Lógica de negocio:**
- **Constraint único**: una entidad solo puede inscribirse una vez por evento (retorna `ConflictError 409`)
- **Respuestas dinámicas (`answers`)**: array de `{ fieldKey, fieldLabel, value }` que se crean junto con la inscripción
- **Timestamps automáticos**: `confirmedAt` se setea automáticamente al cambiar status a CONFIRMED, `attendedAt` al cambiar a ATTENDED
- **Validación cruzada**: verifica que el evento y la entidad existan antes de crear la inscripción

### Portfolio Records (Cartera — FASE 6)

| Método | Ruta                                          | Descripción                                | Validación |
|--------|------------------------------------------------|--------------------------------------------|------------|
| GET    | `/api/v1/portfolios`                          | Listado paginado con filtros y vistas      | `portfolioQuerySchema` (query) |
| GET    | `/api/v1/portfolios/:id`                      | Detalle de registro de cartera             | `portfolioIdParamSchema` (params) |
| POST   | `/api/v1/portfolios`                          | Crear registro de cartera                  | `createPortfolioSchema` (body) |
| PUT    | `/api/v1/portfolios/:id`                      | Actualizar registro de cartera             | `portfolioIdParamSchema` (params) + `updatePortfolioSchema` (body) |
| DELETE | `/api/v1/portfolios/:id`                      | Eliminar registro de cartera (hard delete) | `portfolioIdParamSchema` (params) |
| GET    | `/api/v1/entities/:entityId/portfolios`       | Listar cartera de una entidad específica   | `entityIdParamSchema` (params) + `portfolioQuerySchema` (query) |

**Filtros de cartera:** `search`, `status` (NEW, IN_PROGRESS, WAITING, RESOLVED, CLOSED), `priority` (LOW, MEDIUM, HIGH, URGENT), `assignedToId`, `category`, `sortBy` (createdAt, updatedAt, nextFollowUpDate, priority, status)

**Vistas especiales** (parámetro `view` en query):
- `overdue` — Registros con `nextFollowUpDate` en el pasado y status no cerrado/resuelto
- `upcoming` — Registros con `nextFollowUpDate` en los próximos 7 días
- `unmanaged` — Registros sin responsable asignado (`assignedToId` = null) y sin acciones registradas

**Lógica de negocio:**
- **Asignación de responsable**: campo `assignedToId` opcional, referencia a `User`
- **Timestamps automáticos**: `closedAt` se setea automáticamente al cambiar status a RESOLVED o CLOSED
- **Prioridad y categoría**: filtros de segmentación para la cartera
- **Validación cruzada**: verifica que la entidad y el usuario (si se asigna) existan

### Portfolio Actions (Gestiones — FASE 6)

| Método | Ruta                                                | Descripción                          | Validación |
|--------|------------------------------------------------------|--------------------------------------|------------|
| GET    | `/api/v1/portfolios/:portfolioId/actions`           | Listar acciones de un registro       | `portfolioIdNestedParamSchema` (params) |
| POST   | `/api/v1/portfolios/:portfolioId/actions`           | Registrar acción/gestión             | `portfolioIdNestedParamSchema` (params) + `createActionSchema` (body) |

**Tipos de acción (`actionType`):** CALL, EMAIL_ACTION, VISIT, MEETING, WHATSAPP, NOTE, DOCUMENT, STATUS_CHANGE, OTHER

**Campos de acción:** `description` (requerido), `result` (resultado de la gestión), `nextSteps` (pasos a seguir), `actionDate` (fecha de la gestión, default = ahora)

### Imports (Importaciones masivas — FASE 7)

| Método | Ruta                                          | Descripción                                    | Validación |
|--------|-----------------------------------------------|------------------------------------------------|------------|
| GET    | `/api/v1/imports`                             | Listado paginado de lotes de importación       | `importQuerySchema` (query) |
| GET    | `/api/v1/imports/system-fields`                | Campos del sistema disponibles para mapear     | — |
| POST   | `/api/v1/imports/upload`                       | Subir archivo Excel y crear lote               | `uploadSchema` (body) + `uploadExcel` (multer) |
| GET    | `/api/v1/imports/:id`                         | Detalle de lote con estadísticas               | `importIdParamSchema` (params) |
| DELETE | `/api/v1/imports/:id`                         | Eliminar lote (solo PENDING/CANCELLED/FAILED)  | `importIdParamSchema` (params) |
| GET    | `/api/v1/imports/:id/preview`                 | Vista previa: headers + muestra de filas       | `importIdParamSchema` (params) + `previewQuerySchema` (query) |
| PUT    | `/api/v1/imports/:id/mapping`                 | Actualizar mapeo de columnas                    | `importIdParamSchema` (params) + `updateMappingSchema` (body) |
| POST   | `/api/v1/imports/:id/process`                 | Procesar: staging → validación → deduplicación| `importIdParamSchema` (params) |
| POST   | `/api/v1/imports/:id/execute`                | Importar filas VALID creando entidades         | `importIdParamSchema` (params) |
| POST   | `/api/v1/imports/:id/cancel`                 | Cancelar lote                                  | `importIdParamSchema` (params) |
| GET    | `/api/v1/imports/:id/rows`                   | Listado paginado de staging rows               | `importIdParamSchema` (params) + `stagingQuerySchema` (query) |
| GET    | `/api/v1/imports/:id/rows/:rowId`            | Detalle de una fila staging                    | `rowIdParamSchema` (params) |
| PUT    | `/api/v1/imports/:id/rows/:rowId/resolve`    | Resolver fila (approve/skip/link)              | `rowIdParamSchema` (params) + `resolveRowSchema` (body) |

**Flujo de importación:**
1. **Upload** → POST `/imports/upload` (multipart/form-data con `file` y `sourceType`) → crea `ImportBatch` (PENDING)
2. **Preview** → GET `/imports/:id/preview` → muestra headers + primeras N filas + mapeo sugerido
3. **Mapping** → PUT `/imports/:id/mapping` → usuario confirma/ajusta mapeo de columnas
4. **Process** → POST `/imports/:id/process` → parsea Excel completo, crea `StagingRow`, valida, ejecuta deduplicación → status: REVIEW_REQUIRED
5. **Review** → GET `/imports/:id/rows` → usuario revisa filas DUPLICATE_POSSIBLE/INVALID, resuelve con PUT `/imports/:id/rows/:rowId/resolve`
6. **Import** → POST `/imports/:id/execute` → crea entidades desde filas VALID → status: COMPLETED

**Estados del lote (`ImportStatus`):** PENDING → PROCESSING → VALIDATING → DEDUPLICATING → REVIEW_REQUIRED → IMPORTING → COMPLETED (o FAILED/CANCELLED)

**Estados de staging row (`StagingRowStatus`):** PENDING → VALID/INVALID/DUPLICATE_EXACT/DUPLICATE_POSSIBLE → IMPORTED/SKIPPED/ERROR

**Templates predefinidos:**
- `DIRECTORIO` → mapea establecimientos (establishmentName, economicActivity, province, etc.)
- `EVENTO` / `EVENTO_*` → mapea personas (firstName, lastName, cedula, email, etc.)

**Auto-detección de columnas:** el sistema detecta automáticamente columnas comunes (nombre, apellido, cédula, email, etc.) usando patrones regex

**Deduplicación (5 estrategias):**
1. Cédula exacta → score 1.0 (DUPLICATE_EXACT)
2. RUC exacto → score 1.0 (DUPLICATE_EXACT)
3. Email exacto → score 0.85 (DUPLICATE_POSSIBLE)
4. Teléfono exacto → score 0.75 (DUPLICATE_POSSIBLE)
5. Nombre fuzzy (Dice coefficient) → score 0.6-0.85 (DUPLICATE_POSSIBLE)

**Resolución de filas:** `approve` (marcar como VALID), `skip` (marcar como SKIPPED), `link` (vincular a entidad existente con `linkedEntityId`)

**Límites:** archivos máx. 10MB, extensiones permitidas: .xlsx, .xls, .csv

### Auth (Autenticación y autorización — FASE 8)

| Método | Ruta                              | Descripción                           | Validación | Protegida |
|--------|-----------------------------------|---------------------------------------|------------|-----------|
| POST   | `/api/v1/auth/login`              | Login con email y contraseña          | `loginSchema` (body) | No |
| POST   | `/api/v1/auth/register`           | Registrar nuevo usuario               | `registerSchema` (body) | No |
| POST   | `/api/v1/auth/refresh`            | Renovar tokens con refresh token      | `refreshSchema` (body) | No |
| GET    | `/api/v1/auth/profile`            | Obtener perfil del usuario autenticado| — | Sí (`protect`) |
| PUT    | `/api/v1/auth/profile`            | Actualizar perfil (nombre/apellido)   | `updateProfileSchema` (body) | Sí (`protect`) |
| POST   | `/api/v1/auth/change-password`    | Cambiar contraseña                    | `changePasswordSchema` (body) | Sí (`protect`) |

**Tokens JWT:**
- **Access token**: contiene `sub` (userId), `email`, `role`, `type: 'access'`. Expira según `JWT_EXPIRES_IN` (default 24h)
- **Refresh token**: contiene `sub` (userId), `type: 'refresh'`. Expira según `JWT_REFRESH_EXPIRES_IN` (default 7d)
- Ambos firmados con `JWT_SECRET`

**Hashing de contraseñas:** bcryptjs con 12 salt rounds

**Validación de contraseñas:** mínimo 8 caracteres, al menos una mayúscula, una minúscula y un dígito

**Middlewares de autorización:**
- `protect` — Extrae Bearer token del header `Authorization`, verifica JWT, adjunta `req.user` (con `id`, `email`, `firstName`, `lastName`, `role`, `isActive`)
- `authorize(...roles)` — Debe usarse después de `protect`. Restringe acceso a roles específicos (ej: `authorize('ADMIN', 'MANAGER')`)

**Lógica de negocio:**
- Login verifica que la cuenta esté activa (`isActive: true`), de lo contrario retorna `ForbiddenError 403`
- Registro verifica unicidad de email (retorna `ConflictError 409` si existe)
- Refresh valida el tipo de token (`type: 'refresh'`), verifica que el usuario exista y esté activo
- Cambio de contraseña requiere la contraseña actual correcta y la nueva debe ser diferente
- Se registra `lastLoginAt` en cada login exitoso

---

## 🏛️ Arquitectura de los Módulos CRUD

### Capas por módulo (patrón consistente)

```
modules/<nombre>/
├── <nombre>.routes.ts       ← Definición de rutas Express con middlewares
├── <nombre>.validator.ts    ← Schemas Zod (create, update, query, params)
├── <nombre>.controller.ts   ← Handlers HTTP (req → service → res)
├── <nombre>.service.ts      ← Lógica de negocio (validaciones, transformaciones)
├── <nombre>.repository.ts   ← Queries Prisma (acceso a datos)
└── index.ts                 ← Re-exports
```

### Flujo de una petición

```
Request → Route → validate(middleware) → asyncHandler(controller) → service → repository → Prisma → DB
                                                                  ↓ error
                                                           next(AppError) → errorHandler → Response
```

### Middlewares compartidos

| Archivo                  | Descripción |
|--------------------------|-------------|
| `validate.middleware.ts` | Valida body/query/params con Zod, retorna `ValidationError 400` con detalle por campo |
| `async-handler.ts`       | Wrapper que captura promesas rechazadas y las pasa a `next()` |

### Tipos compartidos (`shared/types/entity.types.ts`)

| Tipo                     | Descripción                                            |
|--------------------------|--------------------------------------------------------|
| `EntityWithRelations`    | Entity + person + company + establishment + contacts   |
| `EntityDetail`           | Entity + todo lo anterior + `_count` de relaciones     |
| `EntityWithPerson`       | Entity + person + contacts (para listado de personas)  |
| `EntityWithCompany`      | Entity + company + contacts (para listado de empresas) |
| `EntityWithEstablishment`| Entity + establishment + contacts (para listado)       |

### Utilidades de strings (`shared/utils/string.utils.ts`)

| Función           | Descripción                                    |
|-------------------|------------------------------------------------|
| `normalizeText`   | Trim, lowercase, elimina acentos, colapsa espacios |
| `normalizeCedula` | Solo dígitos                                   |
| `normalizeRuc`    | Solo dígitos y guiones                         |
| `normalizePhone`  | Solo dígitos, elimina +507                     |
| `normalizeEmail`  | Trim, lowercase                                |
| `titleCase`       | Primera letra mayúscula de cada palabra        |

---

## 🎨 Frontend

### Configuración Actual

- **Next.js 14** con App Router
- **Tailwind CSS** para estilos con sistema de colores `primary-*` personalizado
- **Axios** como cliente HTTP con interceptores para JWT (auto-refresh de tokens)
- **Zustand** para estado global: `auth.store.ts` maneja tokens + user state
- **React Query (TanStack Query)** para data fetching, caching y mutations en todos los módulos
- **React Hook Form + Zod** para formularios de creación/edición
- **Lucide React** para iconos consistentes en toda la UI
- **react-hot-toast** para notificaciones de éxito/error

**CORS y entornos de desarrollo en red:**

- El backend usa `CORS_ORIGIN` como **lista separada por comas** (ej. `http://localhost:3000,http://192.168.99.60:3000`) y valida el `origin` de cada request.
- El frontend no necesita configuración especial adicional (la opción experimental `allowedDevOrigins` de Next 14 se descartó por no estar soportada en la versión actual).
- Para usar la app en red, basta con:
  - Ajustar `CORS_ORIGIN` en `.env` del backend con todos los orígenes permitidos.
  - Levantar el frontend con `next dev` y acceder desde los clientes usando exactamente esos orígenes (incluyendo protocolo y puerto).

### Arquitectura Frontend

```
Página → usePagination hook → useXxxList query → xxxService → apiClient (Axios) → Backend API
                                                                     ↕ interceptors
                                                              authStore (Zustand) → JWT tokens
```

**Patrón de listado estándar:**
1. `usePagination` hook maneja page, limit, search, filters
2. React Query hook (`usePersons`, `useCompanies`, etc.) ejecuta la query paginada
3. Componentes: `SearchBar` + filtros `Select` + `Table` + `Pagination`
4. Modal con formulario para crear/editar (React Hook Form)

**Patrón de detalle:**
1. Dynamic route `[id]/page.tsx` obtiene ID de params
2. React Query hook obtiene datos + datos relacionados
3. `Card` components para secciones de información
4. Modal para edición inline
5. `EntityDetail` component reutilizable para persons/companies/establishments (con Tabs)

### Páginas Implementadas

| Ruta | Descripción | Estado |
|------|-------------|--------|
| `/` | Redirect a `/dashboard` | ✅ |
| `/login` | Login con email/contraseña + JWT | ✅ |
| `/dashboard` | Dashboard con stats cards + resumen cartera + acciones rápidas | ✅ |
| `/dashboard/persons` | Listado personas con búsqueda, filtro provincia, paginación | ✅ |
| `/dashboard/persons/[id]` | Detalle persona (EntityDetail: resumen, contactos, relaciones, eventos, cartera) | ✅ |
| `/dashboard/companies` | Listado empresas con búsqueda, filtro provincia, paginación | ✅ |
| `/dashboard/companies/[id]` | Detalle empresa (EntityDetail) | ✅ |
| `/dashboard/establishments` | Listado establecimientos con búsqueda, filtro provincia, paginación | ✅ |
| `/dashboard/establishments/[id]` | Detalle establecimiento (EntityDetail) | ✅ |
| `/dashboard/events` | Listado eventos con búsqueda, filtro status, crear evento | ✅ |
| `/dashboard/events/[id]` | Detalle evento + tabla inscripciones + editar | ✅ |
| `/dashboard/portfolio` | Listado cartera con filtros status/prioridad, crear registro | ✅ |
| `/dashboard/portfolio/[id]` | Detalle caso + acciones + agregar acción + editar status | ✅ |
| `/dashboard/imports` | Listado importaciones + subir archivo Excel | ✅ |
| `/dashboard/imports/[id]` | Wizard de importación (preview → mapping → process → review) | ✅ |

### Componentes UI Reutilizables

| Componente | Props principales | Descripción |
|------------|-------------------|-------------|
| `Badge` | `variant` (default/primary/success/warning/danger/info/purple), `size` | Etiqueta de estado/categoría |
| `Button` | `variant` (primary/secondary/outline/ghost/danger), `size`, `icon`, `isLoading` | Botón con variantes y loading |
| `Card` | `title`, `description`, `className` | Tarjeta contenedora con header opcional |
| `Table` | `TableHead`, `TableBody`, `TableRow`, `TableHeaderCell`, `TableCell` | Tabla de datos compuesta |
| `Modal` | `isOpen`, `onClose`, `title`, `description`, `footer`, `size` (sm/md/lg/xl) | Diálogo modal overlay |
| `Pagination` | `currentPage`, `totalPages`, `onPageChange` | Paginación con botones prev/next + números |
| `SearchBar` | `onSearch`, `initialQuery`, `debounceMs`, `placeholder` | Barra de búsqueda con debounce |
| `EmptyState` | `icon` (ElementType), `title`, `description`, `action` | Estado vacío con icono y CTA |
| `Input` | `label`, `error`, `helperText` | Campo de entrada con validación |
| `Select` | `label`, `error`, `options` | Selector con validación |
| `Tabs` | `TabList`, `Tab`, `TabPanels`, `TabPanel` | Sistema de pestañas |
| `LoadingSpinner` | `size` | Indicador de carga |

### Hooks Personalizados

| Hook | Descripción |
|------|-------------|
| `useAuth` | Login, logout, guard de rutas, obtiene user del store |
| `usePagination` | Maneja page, limit, search, filters con debounce |
| `usePersons` / `useCompanies` / `useEstablishments` | CRUD queries + mutations por tipo de entidad |
| `useEntities` | Búsqueda cross-type + detalle por ID |
| `useEvents` | CRUD eventos + inscripciones |
| `usePortfolio` | CRUD cartera + acciones |
| `useImports` | Upload, preview, mapping, process, execute, rows, resolve |

### Servicios API

| Servicio | Endpoints que consume |
|----------|----------------------|
| `auth.service.ts` | login, register, refresh, getProfile, updateProfile, changePassword |
| `persons.service.ts` | CRUD `/api/v1/persons` |
| `companies.service.ts` | CRUD `/api/v1/companies` |
| `establishments.service.ts` | CRUD `/api/v1/establishments` |
| `entities.service.ts` | `/api/v1/entities` (búsqueda cross-type + detalle) |
| `contacts.service.ts` | CRUD `/api/v1/entities/:id/contacts` + `/api/v1/contacts/:id` |
| `events.service.ts` | CRUD `/api/v1/events` + `/api/v1/events/:id/registrations` |
| `portfolio.service.ts` | CRUD `/api/v1/portfolios` + `/api/v1/portfolios/:id/actions` |
| `imports.service.ts` | Todos los endpoints de `/api/v1/imports` (upload, preview, mapping, process, execute, rows, resolve) |

---

## 📌 Estado de Implementación por Módulo

| Módulo          | Backend | Frontend | Notas |
|-----------------|---------|----------|-------|
| Health          | ✅      | —        | Health check + DB check |
| Auth            | ✅      | ✅       | Login page, JWT tokens en Zustand store, interceptores Axios, AuthGuard en layout |
| Entities        | ✅      | ✅       | Búsqueda cross-type, EntityDetail reutilizable con tabs |
| Persons         | ✅      | ✅       | Listado + búsqueda + filtros + paginación + modal crear/editar + detalle con tabs |
| Companies       | ✅      | ✅       | Listado + búsqueda + filtros + paginación + modal crear/editar + detalle con tabs |
| Establishments  | ✅      | ✅       | Listado + búsqueda + filtros + paginación + modal crear/editar + detalle con tabs |
| Contacts        | ✅      | ✅       | CRUD dentro de EntityDetail (tab contactos, modal agregar) |
| Events          | ✅      | ✅       | Listado + crear evento + detalle evento con inscripciones + editar |
| Registrations   | ✅      | ✅       | Tabla de inscripciones dentro del detalle de evento |
| Portfolio       | ✅      | ✅       | Listado con filtros status/prioridad + crear + detalle con acciones + editar |
| Actions         | ✅      | ✅       | Tabla de acciones dentro del detalle de cartera + modal agregar acción |
| Imports         | ✅      | ✅       | Listado + upload + wizard completo (preview → mapping → process → review → execute) |
| Dashboard       | —       | ✅       | Stats cards, resumen cartera, acciones rápidas |
| Relationships   | ✅      | ✅       | Relaciones entre entidades (persona→empresa, persona→establecimiento, empresa→establecimiento) |

---

## 🐘 PostgreSQL (Local)

- **PostgreSQL 18.3** instalado nativamente en Windows 11
- Ruta: `C:\Program Files\PostgreSQL\18\`
- Puerto: **55555**
- Usuario: `postgres`
- Contraseña: `p4$$w0rD`
- Base de datos: `emprendedores_db`
- DATABASE_URL: `postgresql://postgres:p4$$w0rD@localhost:55555/emprendedores_db?schema=public`
- Migración `20260310194931_init` aplicada ✅
- Seeds ejecutados ✅

---

## 📜 Historial de Cambios

| Fecha       | Descripción |
|-------------|-------------|
| 2026-03-10  | **FASE 1** — Arquitectura base: schema Prisma completo, estructura de carpetas backend/frontend, configuración Express con middlewares, módulo health, tipos del dominio, cliente Axios, Docker Compose |
| 2026-03-10  | **FASE 2-4** — CRUD maestro: migración `20260310194931_init` aplicada, seeds (usuarios + datos de ejemplo), módulos entities/persons/companies/establishments/contacts implementados con controller/service/repository/validator/routes. Middleware de validación Zod, async-handler, tipos Prisma derivados, utilidades de strings |
| 2026-03-10  | **FASE 5** — Eventos: CRUD de eventos con slug automático, formularios dinámicos (formFields JSON), inscripciones con respuestas variables por evento, rutas anidadas (events/:eventId/registrations, entities/:entityId/registrations), constraint único por evento+entidad, timestamps automáticos (confirmedAt, attendedAt). Seeds con 3 eventos, 5 inscripciones con respuestas |
| 2026-03-10  | **FASE 6** — Cartera/Seguimiento: CRUD de portfolio_records con status, prioridad, categoría, asignación de responsable, fecha de próximo seguimiento. CRUD de portfolio_actions con tipos de gestión (CALL, EMAIL, VISIT, etc.). Vistas especiales: overdue (vencidos), upcoming (próximos 7 días), unmanaged (sin responsable ni acciones). Rutas anidadas (portfolios/:portfolioId/actions, entities/:entityId/portfolios). Seeds con 5 registros de cartera y 7 acciones |
| 2026-03-10  | **FASE 7** — Importaciones masivas: módulo completo de importación desde Excel. Upload con Multer (.xlsx/.xls/.csv, máx. 10MB), parser de Excel (xlsx), mapeo de columnas con templates predefinidos (DIRECTORIO, EVENTO) y auto-detección, staging rows para carga intermedia, validación de filas, deduplicación multi-estrategia (cédula, RUC, email, teléfono, nombre fuzzy), resolución manual de conflictos, importación final creando entidades. Flujo completo: upload → preview → mapping → process → review → execute. Endpoints para gestión de lotes y staging rows con paginación y filtros |
| 2026-03-10  | **FASE 8a** — Autenticación y autorización backend: módulo auth completo con JWT. Login con verificación de credenciales y cuenta activa, registro con validación de email único y contraseña fuerte (mayúscula+minúscula+dígito, mín. 8 chars), refresh de tokens (access + refresh), cambio de contraseña (verifica actual), actualización de perfil, hashing con bcryptjs (12 salt rounds). Middlewares `protect` (verifica Bearer JWT, adjunta req.user) y `authorize(...roles)` (restricción por UserRole). Express.Request augmentado con `user?: AuthUser`. Rutas públicas (login, register, refresh) y protegidas (profile, change-password). Seeds existentes con usuarios admin y operador |
| 2026-03-10  | **FASE 8b** — Frontend completo: Providers (QueryClient + Toaster), Zustand auth store con JWT, login page, dashboard layout con Sidebar+Header+AuthGuard. 14 componentes UI reutilizables (Badge, Button, Card, Modal, Pagination, SearchBar, EmptyState, Input, Select, Tabs, Table, LoadingSpinner, PageHeader). 10 servicios API (auth, persons, companies, establishments, entities, contacts, events, portfolio, imports). 8 React Query hooks. Listados paginados con búsqueda y filtros para todas las entidades. Modales CRUD para personas, empresas, establecimientos. EntityDetail reutilizable con 5 tabs (resumen, contactos, relaciones, eventos, cartera). Eventos: listado, crear, detalle con inscripciones y edición. Cartera: listado con filtros, crear, detalle con acciones y edición. Importaciones: listado, upload Excel, wizard completo de 4 pasos (preview → mapping → process → review/execute). Dashboard con stats y resumen. TypeScript compila con 0 errores |
| 2026-03-11  | **Relaciones** — Implementado módulo `relationships` en backend (validator, repository, service, controller, routes) con endpoints `/entities/:entityId/relationships` y `/relationships/:id`. Integrado al router principal. En frontend se agrega `relationships.service.ts`, hook `useEntityRelationships` y una pestaña “Relaciones” en `EntityDetail` que permite listar relaciones de la entidad y crear nuevas relaciones pegando el ID de la entidad destino. |

---

## 🗺️ Convenciones del Proyecto

### Backend

- **Patrón modular**: cada módulo en `src/modules/<nombre>/` con su propio controller, service, repository, routes, validator
- **Nomenclatura BD**: snake_case (via `@map` en Prisma)
- **Nomenclatura código**: camelCase (TypeScript)
- **IDs**: UUID v4
- **Validación**: Zod schemas en middleware `validate(schema, target)` — target puede ser `body`, `query` o `params`
- **Manejo de errores**: `AppError` + `asyncHandler` wrapper + `errorHandler` middleware
- **Respuestas**: siempre `{ success, data, meta?, error? }`
- **Paginación**: `page`, `limit`, `sortBy`, `sortOrder`, `search`
- **Soft delete**: cambiar `status` a `INACTIVE` (no se eliminan registros, excepto contactos, inscripciones y acciones que usan hard delete)
- **Deduplicación**: por cédula en personas, por RUC en empresas → `ConflictError 409`
- **displayName auto**: se calcula al crear/actualizar con `titleCase()` sobre los campos de nombre
- **Slug automático**: eventos generan slug desde el nombre; colisiones se resuelven con sufijo numérico (-2, -3, etc.)
- **Constraint únicos**: una entidad solo puede inscribirse una vez por evento
- **Timestamps automáticos**: `confirmedAt`/`attendedAt` en inscripciones, `closedAt` en cartera al cambiar status
- **Rutas anidadas**: contactos bajo entidades, inscripciones bajo eventos/entidades, acciones bajo portfolios, portfolios bajo entidades
- **Vistas especiales de cartera**: `?view=overdue|upcoming|unmanaged` para filtros de negocio predefinidos
- **Importaciones**: flujo multi-paso (upload → preview → mapping → process → review → execute), staging intermedio para validación y deduplicación, templates predefinidos por sourceType, auto-detección de columnas por patrones, deduplicación nunca merge automático (solo marca para revisión), resolución manual de conflictos (approve/skip/link)
- **Autenticación JWT**: access token (24h) + refresh token (7d), ambos firmados con `JWT_SECRET`. Access token contiene userId, email, role. bcryptjs con 12 salt rounds. Middleware `protect` extrae Bearer token y adjunta `req.user`. Middleware `authorize(...roles)` restringe por UserRole
- **Roles de usuario**: ADMIN, MANAGER, ANALYST, OPERATOR, VIEWER. El rol por defecto al registrarse es OPERATOR

### Frontend

- **App Router** de Next.js (directorio `app/`)
- **Grupo de rutas**: `(auth)` para login sin sidebar, `(dashboard)` para layout autenticado con sidebar
- **Componentes**: `components/ui/` (atómicos reutilizables), `components/layout/` (estructura), `components/entities/` (compartidos entre entidades)
- **Services**: un service por módulo en `services/`, todos usan `apiClient` (Axios con interceptores JWT)
- **Hooks**: un hook React Query por módulo en `hooks/`, manejan queries paginadas y mutations con invalidación de cache
- **Types**: espejo de los tipos del backend en `types/`
- **Stores**: Zustand para estado global en `stores/` (auth store con tokens + user)
- **Patrón de listado**: `usePagination` → React Query hook → Service → `apiClient` → API
- **Patrón de formulario**: React Hook Form + Zod validation → mutation → toast notification → modal close + cache invalidate
- **Patrón de detalle**: dynamic route `[id]/page.tsx` → React Query hook → `Card` sections / `EntityDetail` con `Tabs`
- **Auth guard**: layout de dashboard verifica token en Zustand store, redirige a `/login` si no autenticado
- **Interceptores Axios**: adjunta Bearer token automáticamente, intenta refresh en 401, redirige a login si refresh falla
- **Notificaciones**: `react-hot-toast` para feedback de éxito (verde) y error (rojo) en mutations
