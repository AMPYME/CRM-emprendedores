import { Router } from 'express';
import { verificationController } from './verification.controller';
import { protect, forbidViewer } from '../auth/auth.middleware';
import { asyncHandler } from '../../shared/utils/async-handler';
import { validate } from '../../shared/middlewares/validate.middleware';
import { verificationQuerySchema, rejectVerificationSchema } from './verification.validator';

export const verificationRoutes = Router();

verificationRoutes.use(protect, forbidViewer);

verificationRoutes.get(
  '/',
  validate(verificationQuerySchema, 'query'),
  asyncHandler(verificationController.list)
);

verificationRoutes.get('/:id', asyncHandler(verificationController.getById));

verificationRoutes.post('/:id/claim', asyncHandler(verificationController.claim));

verificationRoutes.post('/:id/release', asyncHandler(verificationController.release));

verificationRoutes.post('/:id/validate', asyncHandler(verificationController.validate));

verificationRoutes.post(
  '/:id/reject',
  validate(rejectVerificationSchema, 'body'),
  asyncHandler(verificationController.reject)
);
