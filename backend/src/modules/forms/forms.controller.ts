import { Request, Response } from 'express';
import { formsService } from './forms.service';
import { asyncHandler } from '../../shared/utils/async-handler';
import { sendPaginated, sendSuccess } from '../../shared/utils/response.utils';

export const formsController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    const result = await formsService.list();
    sendSuccess(res, result);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const form = await formsService.getById(String(req.params.id));
    sendSuccess(res, form);
  }),

  listSubmissions: asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(String(req.query.limit ?? '25'), 10) || 25)
    );
    const result = await formsService.listSubmissions(String(req.params.id), page, limit);
    sendPaginated(res, result.data, result.meta);
  }),
};
