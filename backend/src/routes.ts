/**
 * Router principal de la API.
 * Monta todas las rutas de cada módulo bajo el prefijo /api/v1.
 */
import { Router } from 'express';
import { healthRoutes } from './modules/health/health.routes';
import { entityRoutes } from './modules/entities/entity.routes';
import { personRoutes } from './modules/persons/person.routes';
import { companyRoutes } from './modules/companies/company.routes';
import { entityContactRoutes, contactRoutes } from './modules/contacts/contact.routes';
import {
  eventRoutes,
  eventRegistrationRoutes,
  entityRegistrationRoutes,
  registrationRoutes,
} from './modules/events/event.routes';
import {
  portfolioRoutes,
  portfolioActionRoutes,
  entityPortfolioRoutes,
} from './modules/portfolio/portfolio.routes';
import {
  entityRelationshipRoutes,
  relationshipRoutes,
} from './modules/relationships/relationship.routes';

import { importRoutes } from './modules/imports/import.routes';

import { intakeRoutes } from './modules/intake/intake.routes';

import { auditRoutes } from './modules/audit/audit.routes';

import { verificationRoutes } from './modules/verifications/verification.routes';

import { authRoutes } from './modules/auth/auth.routes';

export const apiRouter = Router();

// ── Módulo de salud ─────────────────────────────────────────────
apiRouter.use('/health', healthRoutes);

// ── CRUD maestro (FASE 4) ───────────────────────────────────────
apiRouter.use('/entities', entityRoutes);
apiRouter.use('/persons', personRoutes);
apiRouter.use('/companies', companyRoutes);

// Contactos: rutas anidadas bajo entidad + rutas directas
apiRouter.use('/entities/:entityId/contacts', entityContactRoutes);
apiRouter.use('/contacts', contactRoutes);

// ── Eventos e inscripciones (FASE 5) ────────────────────────────
apiRouter.use('/events', eventRoutes);
apiRouter.use('/events/:eventId/registrations', eventRegistrationRoutes);
apiRouter.use('/entities/:entityId/registrations', entityRegistrationRoutes);
apiRouter.use('/registrations', registrationRoutes);

// ── Cartera / seguimiento (FASE 6) ──────────────────────────────
apiRouter.use('/portfolios', portfolioRoutes);
apiRouter.use('/portfolios/:portfolioId/actions', portfolioActionRoutes);
apiRouter.use('/entities/:entityId/portfolios', entityPortfolioRoutes);

// ── Relaciones entre entidades (FASE 4/8) ────────────────────────
apiRouter.use('/entities/:entityId/relationships', entityRelationshipRoutes);
apiRouter.use('/relationships', relationshipRoutes);

// ── Importaciones (FASE 7) ────────────────────────────────────
apiRouter.use('/imports', importRoutes);

// ── Intake de emprendedores (PostgreSQL temporal → WebSocket → CRM) ──
apiRouter.use('/intake', intakeRoutes);

// ── Cola de verificación (importaciones + captura en campo) ─────────
apiRouter.use('/verifications', verificationRoutes);

// ── Autenticación y autorización (FASE 8) ───────────────────────
apiRouter.use('/auth', authRoutes);

// ── Auditoría (solo ADMIN) ───────────────────────────────────────
apiRouter.use('/audit', auditRoutes);
