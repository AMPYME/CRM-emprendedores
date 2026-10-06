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
import { ampymeFormsRoutes } from './modules/forms/forms.routes';
import { capitalSemillaRoutes } from './modules/capital-semilla/capital-semilla.routes';
import { personChangeRoutes } from './modules/person-changes/person-change.routes';
import { siepRoutes } from './modules/siep/siep.routes';
import { sedeRoutes } from './modules/sedes/sede.routes';
import { demographicsRoutes } from './modules/stats/demographics.routes';
import { departamentoRoutes } from './modules/departamentos/departamento.routes';
import { userAdminRoutes } from './modules/users/user.routes';

export const apiRouter = Router();

// ── Módulo de salud ─────────────────────────────────────────────
apiRouter.use('/health', healthRoutes);
apiRouter.use('/stats/demographics', demographicsRoutes);

// ── CRUD maestro (FASE 4) ───────────────────────────────────────
apiRouter.use('/entities', entityRoutes);
apiRouter.use('/persons', personRoutes);
apiRouter.use('/companies', companyRoutes);
apiRouter.use('/capital-semilla', capitalSemillaRoutes);
apiRouter.use('/person-change-requests', personChangeRoutes);
apiRouter.use('/siep', siepRoutes);
apiRouter.use('/sedes', sedeRoutes);
apiRouter.use('/departamentos', departamentoRoutes);
apiRouter.use('/users', userAdminRoutes);

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

// ── Formularios AMPYME (proxy admin vía token AD) ───────────────
apiRouter.use('/ampyme-forms', ampymeFormsRoutes);

// ── Auditoría (solo ADMIN) ───────────────────────────────────────
apiRouter.use('/audit', auditRoutes);
