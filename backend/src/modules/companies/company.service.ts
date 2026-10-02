/**
 * Service del módulo de empresas.
 * Lógica de negocio para CRUD de empresas.
 */
import { Prisma } from '@prisma/client';
import { companyRepository } from './company.repository';
import { CompanyQueryInput, CreateCompanyInput, UpdateCompanyInput } from './company.validator';
import { NotFoundError, ConflictError } from '../../shared/errors/app-error';
import { PaginationMeta } from '../../shared/types/api-response.types';
import { persistableLocationCodes } from '../../shared/utils/entity-location';
import { auditService, AuditActor } from '../audit/audit.service';

function buildDisplayName(legalName: string, tradeName?: string): string {
  return tradeName ? `${tradeName} (${legalName})` : legalName;
}

function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
}

export const companyService = {
  async list(filters: CompanyQueryInput) {
    const result = await companyRepository.findAll(filters);
    return {
      data: result.data,
      meta: buildPaginationMeta(result.total, result.page, result.limit),
    };
  },

  async getById(entityId: string) {
    const entity = await companyRepository.findById(entityId);
    if (!entity) {
      throw new NotFoundError('Empresa', entityId);
    }
    return entity;
  },

  async create(input: CreateCompanyInput, actor?: AuditActor) {
    if (input.ruc) {
      const existing = await companyRepository.findByRuc(input.ruc);
      if (existing) {
        throw new ConflictError(
          `Ya existe una empresa con RUC '${input.ruc}'`,
          { existingEntityId: existing.id, existingName: existing.displayName }
        );
      }
    }

    const loc = await persistableLocationCodes(input);
    const actorId = actor?.userId || null;
    const { companyApiRepository, contactApiRepository } = await import(
      '../../infrastructure/database'
    );

    let entityId: string;
    try {
      entityId = await companyApiRepository.create(actorId, {
        legalName: input.legalName,
        tradeName: input.tradeName,
        ruc: input.ruc,
        dv: input.dv,
        politicalDivisionCode: loc.corregimiento || loc.district || loc.province || null,
        addressLine: input.address ?? null,
        sourceOrigin: input.sourceOrigin || 'MANUAL',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('RUC ya registrado') || msg.includes('23505')) {
        throw new ConflictError(`Ya existe una empresa con RUC '${input.ruc}'`);
      }
      throw err;
    }

    // Sync legacy geo columns + extra company fields
    await companyRepository.update(
      entityId,
      {
        province: loc.province ?? null,
        district: loc.district ?? null,
        corregimiento: loc.corregimiento ?? null,
        notes: input.notes,
        actEc: input.economicActivity?.trim() || null,
        displayName: buildDisplayName(input.legalName, input.tradeName),
      },
      {
        companyType: input.companyType,
        companySizeClass: input.companySizeClass,
        economicActivity: input.economicActivity,
        foundedDate: input.foundedDate ? new Date(input.foundedDate) : undefined,
      }
    );

    if (input.contacts?.length) {
      for (const c of input.contacts) {
        await contactApiRepository.add(actorId, {
          entityId,
          contactType: c.contactType,
          contactValue: c.contactValue,
          label: c.label,
          isPrimary: c.isPrimary,
        });
      }
    }

    return companyService.getById(entityId);
  },

  async update(entityId: string, input: UpdateCompanyInput, actor?: AuditActor) {
    const current = await companyRepository.findById(entityId);
    if (!current) {
      throw new NotFoundError('Empresa', entityId);
    }

    if (input.ruc && input.ruc !== current.company?.ruc) {
      const existing = await companyRepository.findByRuc(input.ruc);
      if (existing && existing.id !== entityId) {
        throw new ConflictError(
          `Ya existe una empresa con RUC '${input.ruc}'`,
          { existingEntityId: existing.id, existingName: existing.displayName }
        );
      }
    }

    const entityData: Prisma.EntityUncheckedUpdateInput = {};
    if (
      input.province !== undefined ||
      input.district !== undefined ||
      input.corregimiento !== undefined
    ) {
      const loc = await persistableLocationCodes({
        province: input.province ?? current.province,
        district: input.district ?? current.district,
        corregimiento: input.corregimiento ?? current.corregimiento,
      });
      if (input.province !== undefined) entityData.province = loc.province ?? null;
      if (input.district !== undefined) entityData.district = loc.district ?? null;
      if (input.corregimiento !== undefined) entityData.corregimiento = loc.corregimiento ?? null;
    }
    if (input.address !== undefined) entityData.address = input.address;
    if (input.notes !== undefined) entityData.notes = input.notes;
    if (input.economicActivity !== undefined) {
      entityData.actEc = input.economicActivity?.trim() || null;
    }

    const companyData: Prisma.CompanyUpdateWithoutEntityInput = {};
    if (input.legalName !== undefined) companyData.legalName = input.legalName;
    if (input.tradeName !== undefined) companyData.tradeName = input.tradeName;
    if (input.ruc !== undefined) companyData.ruc = input.ruc;
    if (input.dv !== undefined) companyData.dv = input.dv;
    if (input.companyType !== undefined) companyData.companyType = input.companyType;
    if (input.companySizeClass !== undefined) companyData.companySizeClass = input.companySizeClass;
    if (input.economicActivity !== undefined) companyData.economicActivity = input.economicActivity;
    if (input.foundedDate !== undefined) {
      companyData.foundedDate = input.foundedDate ? new Date(input.foundedDate) : null;
    }

    if (input.legalName !== undefined || input.tradeName !== undefined) {
      const legalName = input.legalName ?? current.company!.legalName;
      const tradeName = input.tradeName ?? current.company?.tradeName ?? undefined;
      entityData.displayName = buildDisplayName(legalName, tradeName);
    }

    const entity = await companyRepository.update(entityId, entityData, companyData);

    await auditService.log({
      action: 'UPDATE',
      entityType: 'COMPANY',
      entityId: entity.id,
      entityLabel: entity.displayName,
      userId: actor?.userId,
      userEmail: actor?.userEmail,
      metadata: { fields: Object.keys(input) },
    });

    return entity;
  },

  async remove(entityId: string, actor?: AuditActor) {
    const entity = await companyRepository.findById(entityId);
    if (!entity) {
      throw new NotFoundError('Empresa', entityId);
    }
    const { companyApiRepository } = await import('../../infrastructure/database');
    await companyApiRepository.softDelete(actor?.userId || null, entityId);
    return entity;
  },
};
