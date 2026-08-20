import { Request, Response } from 'express';
import { auditService } from './audit.service';
import { sendPaginated } from '../../shared/utils/response.utils';

export const auditController = {
  async list(req: Request, res: Response): Promise<void> {
    const result = await auditService.list(req.query as any);
    sendPaginated(res, result.data, result.meta);
  },
};
