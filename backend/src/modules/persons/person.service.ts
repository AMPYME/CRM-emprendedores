/**
 * Service del módulo de personas.
 * Lógica de negocio para CRUD de personas.
 */
import { Prisma } from '@prisma/client';
import { personRepository } from './person.repository';
import { PersonQueryInput, CreatePersonInput, UpdatePersonInput } from './person.validator';
import { NotFoundError, ConflictError } from '../../shared/errors/app-error';
import { PaginationMeta } from '../../shared/types/api-response.types';
import { titleCase } from '../../shared/utils/string.utils';
import { locationInputToCodes } from '../../shared/utils/division-politica';
import { DEFAULT_NATIONALITY_CODE } from '../../shared/utils/nationality';

// ── Helpers ───────────────────────────────────────────────────────

function buildDisplayName(firstName: string, lastName: string, secondLastName?: string): string {
  const parts = [titleCase(firstName), titleCase(lastName)];
  if (secondLastName) parts.push(titleCase(secondLastName));
  return parts.join(' ');
}

function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
}

// ── Service ───────────────────────────────────────────────────────

export const personService = {
  /**
   * Listado paginado de personas con filtros.
   */
  async list(filters: PersonQueryInput) {
    const result = await personRepository.findAll(filters);
    return {
      data: result.data,
      meta: buildPaginationMeta(result.total, result.page, result.limit),
    };
  },

  /**
   * Detalle completo de una persona por entity ID.
   */
  async getById(entityId: string) {
    const entity = await personRepository.findById(entityId);
    if (!entity) {
      throw new NotFoundError('Persona', entityId);
    }
    return entity;
  },

  /**
   * Crear persona nueva (entidad + persona + contactos en transacción).
   */
  async create(input: CreatePersonInput) {
    // Deduplicación básica por cédula
    if (input.cedula) {
      const existing = await personRepository.findByCedula(input.cedula);
      if (existing) {
        throw new ConflictError(
          `Ya existe una persona con cédula '${input.cedula}'`,
          { existingEntityId: existing.id, existingName: existing.displayName }
        );
      }
    }

    const displayName = buildDisplayName(input.firstName, input.lastName, input.secondLastName);
    const loc = locationInputToCodes(input);

    return personRepository.create({
      displayName,
      province: loc.province,
      district: loc.district,
      corregimiento: loc.corregimiento,
      address: input.address,
      notes: input.notes,
      sourceOrigin: input.sourceOrigin || 'MANUAL',
      person: {
        firstName: input.firstName,
        lastName: input.lastName,
        secondLastName: input.secondLastName,
        cedula: input.cedula,
        gender: input.gender as any,
        birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
        nationalityCode: input.nationalityCode ?? DEFAULT_NATIONALITY_CODE,
        educationLevel: input.educationLevel,
        occupation: input.occupation,
        businessName: input.businessName,
        economicActivity: input.economicActivity,
      },
      contacts: input.contacts,
    });
  },

  /**
   * Actualizar persona existente.
   */
  async update(entityId: string, input: UpdatePersonInput) {
    const current = await personRepository.findById(entityId);
    if (!current) {
      throw new NotFoundError('Persona', entityId);
    }

    // Si cambia cédula, verificar que no exista otra persona con esa cédula
    if (input.cedula && input.cedula !== current.person?.cedula) {
      const existing = await personRepository.findByCedula(input.cedula);
      if (existing && existing.id !== entityId) {
        throw new ConflictError(
          `Ya existe una persona con cédula '${input.cedula}'`,
          { existingEntityId: existing.id, existingName: existing.displayName }
        );
      }
    }

    // Datos de entidad (Entity)
    const entityData: Prisma.EntityUncheckedUpdateInput = {};
    if (
      input.province !== undefined ||
      input.district !== undefined ||
      input.corregimiento !== undefined
    ) {
      const loc = locationInputToCodes({
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

    // Datos de persona (Person)
    const personData: Prisma.PersonUpdateWithoutEntityInput = {};
    if (input.firstName !== undefined) personData.firstName = input.firstName;
    if (input.lastName !== undefined) personData.lastName = input.lastName;
    if (input.secondLastName !== undefined) personData.secondLastName = input.secondLastName;
    if (input.cedula !== undefined) personData.cedula = input.cedula;
    if (input.gender !== undefined) personData.gender = input.gender as any;
    if (input.birthDate !== undefined) personData.birthDate = new Date(input.birthDate);
    if (input.nationalityCode !== undefined) personData.nationalityCode = input.nationalityCode;
    if (input.educationLevel !== undefined) personData.educationLevel = input.educationLevel;
    if (input.occupation !== undefined) personData.occupation = input.occupation;
    if (input.businessName !== undefined) personData.businessName = input.businessName;
    if (input.economicActivity !== undefined) personData.economicActivity = input.economicActivity;

    // Recalcular displayName si cambiaron campos de nombre
    if (input.firstName !== undefined || input.lastName !== undefined || input.secondLastName !== undefined) {
      const firstName = input.firstName ?? current.person!.firstName;
      const lastName = input.lastName ?? current.person!.lastName;
      const secondLastName = input.secondLastName ?? current.person?.secondLastName ?? undefined;
      entityData.displayName = buildDisplayName(firstName, lastName, secondLastName);
    }

    return personRepository.update(entityId, entityData, personData);
  },

  /**
   * Soft delete: marca la persona como INACTIVE.
   */
  async remove(entityId: string) {
    const entity = await personRepository.findById(entityId);
    if (!entity) {
      throw new NotFoundError('Persona', entityId);
    }
    return personRepository.softDelete(entityId);
  },
};
