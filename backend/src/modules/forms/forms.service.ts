import { NotFoundError } from '../../shared/errors/app-error';
import { formsRepository } from './forms.repository';
import type {
  AmpymeFormRecord,
  AmpymeFormsListPayload,
  AmpymeFormSubmissionsPayload,
} from './forms.types';

export const formsService = {
  async list(): Promise<AmpymeFormsListPayload> {
    const forms = await formsRepository.findAll();
    return { forms, source: 'mysql' };
  },

  async getById(formId: string): Promise<AmpymeFormRecord> {
    const id = Number.parseInt(formId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      throw new NotFoundError('Formulario', formId);
    }

    const form = await formsRepository.findById(id);
    if (!form) {
      throw new NotFoundError('Formulario', formId);
    }

    return form;
  },

  async listSubmissions(
    formId: string,
    page = 1,
    limit = 25
  ): Promise<AmpymeFormSubmissionsPayload> {
    const id = Number.parseInt(formId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      throw new NotFoundError('Formulario', formId);
    }

    const form = await formsRepository.findById(id);
    if (!form) {
      throw new NotFoundError('Formulario', formId);
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    return formsRepository.findSubmissionsByFormId(id, safePage, safeLimit);
  },
};
