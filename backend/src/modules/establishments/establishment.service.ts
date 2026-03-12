/**
 * Service del módulo de establecimientos.
 * Lógica de negocio para CRUD de establecimientos.
 */
import { Prisma } from '@prisma/client';
import { establishmentRepository } from './establishment.repository';
import {
  EstablishmentQueryInput,
  CreateEstablishmentInput,
  UpdateEstablishmentInput,
} from './establishment.validator';
import { NotFoundError } from '../../shared/errors/app-error';
import { PaginationMeta } from '../../shared/types/api-response.types';

// ── Helpers ───────────────────────────────────────────────────────

function buildDisplayName(name: string, address?: string): string {
  return address ? `${name} - ${address}` : name;
}

function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
}

// ── Service ───────────────────────────────────────────────────────

export const establishmentService = {
  /**
   * Listado paginado de establecimientos con filtros.
   */
  async list(filters: EstablishmentQueryInput) {
    const result = await establishmentRepository.findAll(filters);
    return {
      data: result.data,
      meta: buildPaginationMeta(result.total, result.page, result.limit),
    };
  },

  /**
   * Detalle completo de un establecimiento por entity ID.
   */
  async getById(entityId: string) {
    const entity = await establishmentRepository.findById(entityId);
    if (!entity) {
      throw new NotFoundError('Establecimiento', entityId);
    }
    return entity;
  },

  /**
   * Crear establecimiento nuevo.
   */
  async create(input: CreateEstablishmentInput) {
    const displayName = buildDisplayName(
      input.establishmentName,
      input.address || input.corregimiento
    );

    return establishmentRepository.create({
      displayName,
      province: input.province,
      district: input.district,
      corregimiento: input.corregimiento,
      address: input.address,
      notes: input.notes,
      sourceOrigin: input.sourceOrigin || 'MANUAL',
      establishment: {
        establishmentName: input.establishmentName,
        establishmentType: input.establishmentType,
        economicActivity: input.economicActivity,
        noticeOfOperation: input.noticeOfOperation,
        latitude: input.latitude,
        longitude: input.longitude,
      },
      contacts: input.contacts,
    });
  },

  /**
   * Actualizar establecimiento existente.
   */
  async update(entityId: string, input: UpdateEstablishmentInput) {
    const current = await establishmentRepository.findById(entityId);
    if (!current) {
      throw new NotFoundError('Establecimiento', entityId);
    }

    // Datos de entidad
    const entityData: Prisma.EntityUpdateInput = {};
    if (input.province !== undefined) entityData.province = input.province;
    if (input.district !== undefined) entityData.district = input.district;
    if (input.corregimiento !== undefined) entityData.corregimiento = input.corregimiento;
    if (input.address !== undefined) entityData.address = input.address;
    if (input.notes !== undefined) entityData.notes = input.notes;

    // Datos de establecimiento
    const estabData: Prisma.EstablishmentUpdateWithoutEntityInput = {};
    if (input.establishmentName !== undefined) estabData.establishmentName = input.establishmentName;
    if (input.establishmentType !== undefined) estabData.establishmentType = input.establishmentType;
    if (input.economicActivity !== undefined) estabData.economicActivity = input.economicActivity;
    if (input.noticeOfOperation !== undefined) estabData.noticeOfOperation = input.noticeOfOperation;
    if (input.latitude !== undefined) estabData.latitude = input.latitude;
    if (input.longitude !== undefined) estabData.longitude = input.longitude;

    // Recalcular displayName si cambió el nombre o dirección
    if (input.establishmentName !== undefined || input.address !== undefined) {
      const name = input.establishmentName ?? current.establishment!.establishmentName;
      const addr = input.address ?? current.address ?? undefined;
      entityData.displayName = buildDisplayName(name, addr);
    }

    return establishmentRepository.update(entityId, entityData, estabData);
  },

  /**
   * Soft delete: marca el establecimiento como INACTIVE.
   */
  async remove(entityId: string) {
    const entity = await establishmentRepository.findById(entityId);
    if (!entity) {
      throw new NotFoundError('Establecimiento', entityId);
    }
    return establishmentRepository.softDelete(entityId);
  },
};
