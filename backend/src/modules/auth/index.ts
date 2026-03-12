/**
 * Módulo de autenticación y autorización (FASE 8).
 *
 * Componentes:
 * - auth.types.ts        → Interfaces de JWT payloads y respuesta
 * - auth.validator.ts    → Schemas Zod para login, registro, etc.
 * - auth.repository.ts   → Queries Prisma sobre tabla users
 * - auth.service.ts      → Lógica de negocio (JWT, hashing, login/register)
 * - auth.middleware.ts    → Middlewares protect y authorize
 * - auth.controller.ts   → Handlers Express
 * - auth.routes.ts       → Definición de rutas
 */
export * from './auth.types';
export * from './auth.validator';
export * from './auth.repository';
export * from './auth.service';
export * from './auth.middleware';
export * from './auth.controller';
export * from './auth.routes';
