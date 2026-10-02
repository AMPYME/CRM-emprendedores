/**
 * Objetos SQL versionados fuera de lo que Prisma modela (roles, triggers, views, procedures).
 * Las migraciones en prisma/migrations/ son la fuente de verdad aplicable.
 *
 * Schemas: catalog, security, core, crm, events, imports, verification, intake, audit, integration, api, workflow
 * Roles: crm_owner, crm_migrator, crm_api, crm_readonly_admin, rempresarial_viewer
 *
 * Frontera Backend:
 *   DATABASE_URL          → crm_api (solo schema api)
 *   DATABASE_MIGRATE_URL  → crm_migrator / owner (DDL)
 */
