/**
 * Módulo de Relaciones entre Entidades.
 *
 * Permite vincular personas, empresas y establecimientos mediante
 * el modelo `EntityRelationship` de Prisma.
 *
 * Rutas principales:
 * - `GET /api/v1/entities/:entityId/relationships`
 * - `POST /api/v1/entities/:entityId/relationships`
 * - `PUT /api/v1/relationships/:id`
 * - `DELETE /api/v1/relationships/:id`
 */
export * from './relationship.routes';
export * from './relationship.controller';
export * from './relationship.service';
export * from './relationship.repository';
export * from './relationship.validator';
export * from './relationship.rules';
