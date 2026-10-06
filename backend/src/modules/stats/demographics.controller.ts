import { Request, Response } from 'express';
import { demographicsService } from './demographics.service';
import { sendSuccess } from '../../shared/utils/response.utils';

export const demographicsController = {
  async get(_req: Request, res: Response): Promise<void> {
    const data = await demographicsService.get();
    sendSuccess(res, data);
  },
};
