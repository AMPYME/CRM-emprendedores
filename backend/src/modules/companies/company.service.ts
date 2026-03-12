/**
 * Service del módulo de empresas.
 * Lógica de negocio para CRUD de empresas.
 */
import { Prisma } from '@prisma/client';
import { companyRepository } from './company.repository';
import { CompanyQueryInput, CreateCompanyInput, UpdateCompanyInput } from './company.validator';
import { NotFoundError, ConflictError } from '../../shared/errors/app-error';
import { PaginationMeta } from '../../shared/types/api-response.types';

// ── Helpers ───────────────────────────────────────────────────────

function buildDisplayName(legalName: string, tradeName?: string): string {
  return tradeName ? `${tradeName} (${legalName})` : legalName;
}

function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
}

// ── Service ───────────────────────────────────────────────────────

export const companyService = {
  /**
   * Listado paginado de empresas con filtros.
   */
  async list(filters: CompanyQueryInput) {
    const result = await companyRepository.findAll(filters);
    return {
      data: result.data,
      meta: buildPaginationMeta(result.total, result.page, result.limit),
    };
  },

  /**
   * Detalle completo de una empresa por entity ID.
   */
  async getById(entityId: string) {
    const entity = await companyRepository.findById(entityId);
    if (!entity) {
      throw new NotFoundError('Empresa', entityId);
    }
    return entity;
  },

  /**
   * Crear empresa nueva (entidad + empresa + contactos en transacción).
   */
  async create(input: CreateCompanyInput) {
    // Deduplicación básica por RUC
    if (input.ruc) {
      const existing = await companyRepository.findByRuc(input.ruc);
      if (existing) {
        throw new ConflictError(
          `Ya existe una empresa con RUC '${input.ruc}'`,
          { existingEntityId: existing.id, existingName: existing.displayName }
        );
      }
    }

    const displayName = buildDisplayName(input.legalName, input.tradeName);

    return companyRepository.create({
      displayName,
      province: input.province,
      district: input.district,
      corregimiento: input.corregimiento,
      address: input.address,
      notes: input.notes,
      sourceOrigin: input.sourceOrigin || 'MANUAL',
      company: {
        legalName: input.legalName,
        tradeName: input.tradeName,
        ruc: input.ruc,
        dv: input.dv,
        companyType: input.companyType,
        economicActivity: input.economicActivity,
        foundedDate: input.foundedDate ? new Date(input.foundedDate) : undefined,
        employeeCount: input.employeeCount,
      },
      contacts: input.contacts,
    });
  },

  /**
   * Actualizar empresa existente.
   */
  async update(entityId: string, input: UpdateCompanyInput) {
    const current = await companyRepository.findById(entityId);
    if (!current) {
      throw new NotFoundError('Empresa', entityId);
    }

    // Si cambia RUC, verificar unicidad
    if (input.ruc && input.ruc !== current.company?.ruc) {
      const existing = await companyRepository.findByRuc(input.ruc);
      if (existing && existing.id !== entityId) {
        throw new ConflictError(
          `Ya existe una empresa con RUC '${input.ruc}'`,
          { existingEntityId: existing.id, existingName: existing.displayName }
        );
      }
    }

    // Datos de entidad
    const entityData: Prisma.EntityUpdateInput = {};
    if (input.province !== undefined) entityData.province = input.province;
    if (input.district !== undefined) entityData.district = input.district;
    if (input.corregimiento !== undefined) entityData.corregimiento = input.corregimiento;
    if (input.address !== undefined) entityData.address = input.address;
    if (input.notes !== undefined) entityData.notes = input.notes;

    // Datos de empresa
    const companyData: Prisma.CompanyUpdateWithoutEntityInput = {};
    if (input.legalName !== undefined) companyData.legalName = input.legalName;
    if (input.tradeName !== undefined) companyData.tradeName = input.tradeName;
    if (input.ruc !== undefined) companyData.ruc = input.ruc;
    if (input.dv !== undefined) companyData.dv = input.dv;
    if (input.companyType !== undefined) companyData.companyType = input.companyType;
    if (input.economicActivity !== undefined) companyData.economicActivity = input.economicActivity;
    if (input.foundedDate !== undefined) companyData.foundedDate = new Date(input.foundedDate);
    if (input.employeeCount !== undefined) companyData.employeeCount = input.employeeCount;

    // Recalcular displayName si cambiaron nombre legal o comercial
    if (input.legalName !== undefined || input.tradeName !== undefined) {
      const legalName = input.legalName ?? current.company!.legalName;
      const tradeName = input.tradeName ?? current.company?.tradeName ?? undefined;
      entityData.displayName = buildDisplayName(legalName, tradeName);
    }

    return companyRepository.update(entityId, entityData, companyData);
  },

  /**
   * Soft delete: marca la empresa como INACTIVE.
   */
  async remove(entityId: string) {
    const entity = await companyRepository.findById(entityId);
    if (!entity) {
      throw new NotFoundError('Empresa', entityId);
    }
    return companyRepository.softDelete(entityId);
  },
};
