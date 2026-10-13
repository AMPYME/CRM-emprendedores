/**
 * Middlewares de autenticación y autorización.
 *
 * - protect:   Verifica el Bearer token, sesión local (sid) y adjunta req.user.
 * - authorize: Restringe acceso a roles específicos (rol fresco de BD).
 */
import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { authService } from './auth.service';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors/app-error';
import {
  isReadOnlyCrmRole,
  canAccessImports,
  FULL_ACCESS_ROLES,
} from './ad-auth.mapper';

/**
 * Middleware que protege rutas.
 * Extrae el JWT del header Authorization, valida firma/exp/sesión local, adjunta req.user.
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
      const { sessionId, ...authUser } = user;
      req.user = authUser;
      req.sessionId = sessionId;
      next();
    })
    .catch(next);
}

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

/** Bloquea mutaciones para roles EMPREND_VIEWER. */
export function forbidReadOnly(req: Request, _res: Response, next: NextFunction): void {
  if (req.user && isReadOnlyCrmRole(req.user.role)) {
    next(new ForbiddenError('Su rol es de solo lectura. No puede modificar registros.'));
    return;
  }
  next();
}

/** Bloquea roles de solo lectura (EMPREND_VIEWER) en módulos fuera de Personas/Empresas. */
export function forbidViewer(req: Request, _res: Response, next: NextFunction): void {
  if (req.user && isReadOnlyCrmRole(req.user.role)) {
    next(new ForbiddenError('Su rol no tiene acceso a este módulo.'));
    return;
  }
  next();
}

/** Solo SUPER_ADMIN / ADMIN / EMPREND_ADMIN (importaciones, auditoría, etc.). */
export function requireFullAccess(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new UnauthorizedError('No autenticado'));
    return;
  }
  if (!canAccessImports(req.user.role)) {
    next(new ForbiddenError('Acceso denegado. Se requiere rol de administración.'));
    return;
  }
  next();
}

export { FULL_ACCESS_ROLES };
