/**
 * Rutas del módulo de cartera/seguimiento.
 *
 * Cartera:
 *   GET    /api/v1/portfolios                        — listado paginado (con vistas)
 *   GET    /api/v1/portfolios/stats                  — estadísticas
 *   POST   /api/v1/portfolios                        — crear registro
 *   GET    /api/v1/portfolios/:id                    — detalle con acciones
 *   PUT    /api/v1/portfolios/:id                    — actualizar
 *
 * Acciones anidadas bajo cartera:
 *   GET    /api/v1/portfolios/:portfolioId/actions   — listar acciones
 *   POST   /api/v1/portfolios/:portfolioId/actions   — agregar acción
 *
 * Cartera por entidad:
 *   GET    /api/v1/entities/:entityId/portfolios     — cartera de la entidad
 */
import { Router } from 'express';
import { portfolioController } from './portfolio.controller';
import { asyncHandler } from '../../shared/utils/async-handler';
import { validate } from '../../shared/middlewares/validate.middleware';
import {
  createPortfolioSchema,
  updatePortfolioSchema,
  createActionSchema,
  portfolioQuerySchema,
  portfolioIdParamSchema,
  portfolioIdNestedParamSchema,
} from './portfolio.validator';
import { entityIdParamSchema } from '../contacts/contact.validator';

// ── Rutas principales de cartera ──────────────────────────────────
export const portfolioRoutes = Router();

portfolioRoutes.get(
  '/',
  validate(portfolioQuerySchema, 'query'),
  asyncHandler(portfolioController.list)
);

// IMPORTANTE: /stats debe ir ANTES de /:id para evitar que "stats" se interprete como UUID
portfolioRoutes.get(
  '/stats',
  asyncHandler(portfolioController.getStats)
);

portfolioRoutes.post(
  '/',
  validate(createPortfolioSchema, 'body'),
  asyncHandler(portfolioController.create)
);

portfolioRoutes.get(
  '/:id',
  validate(portfolioIdParamSchema, 'params'),
  asyncHandler(portfolioController.getById)
);

portfolioRoutes.put(
  '/:id',
  validate(portfolioIdParamSchema, 'params'),
  validate(updatePortfolioSchema, 'body'),
  asyncHandler(portfolioController.update)
);

// ── Acciones anidadas (/portfolios/:portfolioId/actions) ──────────
export const portfolioActionRoutes = Router({ mergeParams: true });

portfolioActionRoutes.get(
  '/',
  validate(portfolioIdNestedParamSchema, 'params'),
  asyncHandler(portfolioController.listActions)
);

portfolioActionRoutes.post(
  '/',
  validate(portfolioIdNestedParamSchema, 'params'),
  validate(createActionSchema, 'body'),
  asyncHandler(portfolioController.addAction)
);

// ── Cartera por entidad (/entities/:entityId/portfolios) ──────────
export const entityPortfolioRoutes = Router({ mergeParams: true });

entityPortfolioRoutes.get(
  '/',
  validate(entityIdParamSchema, 'params'),
  asyncHandler(portfolioController.listByEntity)
);
