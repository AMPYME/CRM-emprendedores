/**
 * Proxy autenticado CRM → SIEP (el browser no habla con SIEP).
 */
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler';
import { sendSuccess } from '../../shared/utils/response.utils';
import { protect } from '../auth/auth.middleware';
import { siepClient } from './siep.client';
import { BadRequestError } from '../../shared/errors/app-error';
import { prisma } from '../../config/database';

export const siepRoutes = Router();

siepRoutes.use(protect);

siepRoutes.get(
  '/catalogos/provincias',
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await siepClient.listProvincias();
    sendSuccess(res, data);
  })
);

siepRoutes.get(
  '/catalogos/sectores',
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await siepClient.listSectores();
    sendSuccess(res, data);
  })
);

siepRoutes.get(
  '/empresas',
  asyncHandler(async (req: Request, res: Response) => {
    const ruc = String(req.query.ruc || '').trim();
    if (!ruc) throw new BadRequestError('Parámetro ruc requerido');
    const empresa = await siepClient.findEmpresaByRuc(ruc);
    sendSuccess(res, empresa);
  })
);

siepRoutes.get(
  '/empresas/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const empresa = await siepClient.getEmpresa(String(req.params.id));
    sendSuccess(res, empresa);
  })
);

siepRoutes.get(
  '/empresas/:id/garantias',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await siepClient.getEmpresaGarantias(String(req.params.id));
    sendSuccess(res, data);
  })
);

siepRoutes.get(
  '/empresas/:id/capacitaciones',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await siepClient.getEmpresaCapacitaciones(String(req.params.id));
    sendSuccess(res, data);
  })
);

siepRoutes.get(
  '/personas',
  asyncHandler(async (req: Request, res: Response) => {
    const documento = String(req.query.documento || '').trim();
    if (!documento) throw new BadRequestError('Parámetro documento (cédula) requerido');
    const persona = await siepClient.findPersonaByDocumento(documento);
    sendSuccess(res, persona);
  })
);

siepRoutes.get(
  '/personas/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const persona = await siepClient.getPersona(String(req.params.id));
    sendSuccess(res, persona);
  })
);

/** Vincula una Entity CRM con el publicId de SIEP (referencia estable). */
siepRoutes.post(
  '/entities/:entityId/link',
  asyncHandler(async (req: Request, res: Response) => {
    const entityId = String(req.params.entityId);
    const siepPublicId = String(req.body?.siepPublicId || '').trim();
    if (!siepPublicId) throw new BadRequestError('siepPublicId requerido');
    // Verifica que exista en SIEP
    await siepClient.getEmpresa(siepPublicId);
    const updated = await prisma.entity.update({
      where: { id: entityId },
      data: { siepPublicId },
      select: { id: true, displayName: true, siepPublicId: true },
    });
    sendSuccess(res, updated);
  })
);
