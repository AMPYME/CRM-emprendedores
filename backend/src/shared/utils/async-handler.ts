/**
 * Wrapper para handlers async de Express.
 * Captura errores de promesas y los pasa a next() automáticamente.
 * Evita repetir try/catch en cada controller.
 */
import { Request, Response, NextFunction } from 'express';

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
