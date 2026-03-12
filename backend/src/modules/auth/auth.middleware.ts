/**
 * Middlewares de autenticación y autorización.
 *
 * - protect:   Verifica el Bearer token y adjunta req.user.
 * - authorize: Restringe acceso a roles específicos.
 */
import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { authService } from './auth.service';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors/app-error';

/**
 * Middleware que protege rutas.
 * Extrae el JWT del header Authorization, lo valida, y adjunta el usuario a req.user.
 */
export function protect(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new UnauthorizedError('Token de acceso requerido'));
    return;
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    next(new UnauthorizedError('Token de acceso requerido'));
    return;
  }

  authService
    .verifyAccessToken(token)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch(next);
}

/**
 * Middleware de autorización por rol.
 * Debe usarse DESPUÉS de `protect`.
 *
 * @param allowedRoles - Roles que tienen acceso a la ruta.
 *
 * @example
 *   router.get('/admin-only', protect, authorize('ADMIN'), handler);
 *   router.get('/managers', protect, authorize('ADMIN', 'MANAGER'), handler);
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('No autenticado'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new ForbiddenError(
          `Acceso denegado. Roles requeridos: ${allowedRoles.join(', ')}`
        )
      );
      return;
    }

    next();
  };
}
