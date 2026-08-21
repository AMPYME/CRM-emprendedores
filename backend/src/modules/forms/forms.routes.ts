import { Router } from 'express';
import { protect } from '../auth/auth.middleware';
import { formsController } from './forms.controller';

export const ampymeFormsRoutes = Router();

ampymeFormsRoutes.use(protect);
ampymeFormsRoutes.get('/', formsController.list);
ampymeFormsRoutes.get('/:id/submissions', formsController.listSubmissions);
ampymeFormsRoutes.get('/:id', formsController.getById);
