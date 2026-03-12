/**
 * Rutas del módulo de salud/healthcheck.
 */
import { Router } from 'express';
import { healthController } from './health.controller';

export const healthRoutes = Router();

healthRoutes.get('/', healthController.check);
healthRoutes.get('/db', healthController.checkDatabase);
