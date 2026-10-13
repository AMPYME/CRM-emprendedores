/**
 * Middleware global de manejo de errores.
 * Captura errores lanzados en cualquier punto de la cadena y
 * responde con el formato estándar de la API.
 */
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError, BadRequestError, ConflictError, NotFoundError } from '../errors/app-error';
import { logger } from '../logger/logger';
import { ApiResponse } from '../types/api-response.types';

function prismaToAppError(err: unknown): AppError | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return null;
  // RAISE EXCEPTION desde api.fn_* (queryRaw)
  if (err.code === 'P2010') {
    const raw = String(err.meta?.message ?? err.message ?? '');
    const msg = raw.replace(/^Error occurred during query execution:.*?Message:\s*/is, '').trim() || raw;
    if (/no encontrada|no encontrado|inexistente/i.test(msg)) {
      return new AppError(msg, 404, 'NOT_FOUND');
    }
    if (/ya tiene|solo puede existir|duplicad/i.test(msg)) {
      return new ConflictError(msg);
    }
    if (/inválid|requiere|no pertenece|misma versión|formato|búsqueda/i.test(msg)) {
      return new BadRequestError(msg);
    }
  }
  if (err.code === 'P2002') {
    return new ConflictError('Ya existe un registro con esos datos únicos.');
  }
  if (err.code === 'P2003') {
    const field = String(err.meta?.field_name ?? err.meta?.constraint ?? '');
    if (/cod_prov|cod_dist|cod_corr|provincia|distrito|corregimiento/i.test(field)) {
      return new BadRequestError(
        'La provincia, distrito o corregimiento no está en el catálogo. Deje la ubicación vacía o cargue la división política.'
      );
    }
    if (/created_by/i.test(field)) {
      return new BadRequestError('El usuario de la sesión no existe en el CRM. Cierre sesión e ingrese de nuevo.');
    }
    if (/intake_session/i.test(field)) {
      return new BadRequestError('No se pudo cerrar la sesión de captura. Intente de nuevo.');
    }
    return new BadRequestError('No se pudo guardar: hay una referencia inválida.');
  }
  if (err.code === 'P2022') {
    return new BadRequestError('La base de datos no tiene una columna requerida. Aplique las migraciones del CRM.');
  }
  if (err.code === 'P2025') {
    return new NotFoundError('Registro');
  }
  return new BadRequestError('No se pudo guardar el registro.');
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const prismaErr = prismaToAppError(err);
  if (prismaErr) {
    err = prismaErr;
  }

  if (err.message === 'Not allowed by CORS') {
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: {
        code: 'FORBIDDEN',
        message: 'Origen no permitido por CORS. Incluya el dominio HTTPS del frontend en CORS_ORIGIN.',
      },
    };
    res.status(403).json(response);
    return;
  }

  // Si es un error controlado de la aplicación
  if (err instanceof AppError) {
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    };

    if (err.statusCode >= 500) {
      logger.error(`[${err.code}] ${err.message}`, { stack: err.stack });
    } else {
      logger.warn(`[${err.code}] ${err.message}`);
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Error no controlado
  logger.error('Error no controlado:', { message: err.message, stack: err.stack });

  const response: ApiResponse<null> = {
    success: false,
    data: null,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'Error interno del servidor'
          : err.message,
    },
  };

  res.status(500).json(response);
}
