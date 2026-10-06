import { Router } from 'express';
import { protect } from '../auth/auth.middleware';
import { asyncHandler } from '../../shared/utils/async-handler';
import { demographicsController } from './demographics.controller';

export const demographicsRoutes = Router();

demographicsRoutes.get('/', protect, asyncHandler(demographicsController.get));
