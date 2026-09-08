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
import { persistableLocationCodes } from '../../shared/utils/entity-location';
import { DEFAULT_NATIONALITY_CODE } from '../../shared/utils/nationality';
import { auditService, AuditActor } from '../audit/audit.service';

function buildDisplayName(firstName: string, lastName: string, secondLastName?: string): string {
  const parts = [titleCase(firstName), titleCase(lastName)];
  if (secondLastName) parts.push(titleCase(secondLastName));
  return parts.join(' ');
}

function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
}

export const personService = {
  async list(filters: PersonQueryInput) {
    const result = await personRepository.findAll(filters);
    return {
      data: result.data,
      meta: buildPaginationMeta(result.total, result.page, result.limit),
    };
  },

  async getById(entityId: string) {
    const entity = await personRepository.findById(entityId);
    if (!entity) {
      throw new NotFoundError('Persona', entityId);
    }
    return entity;
  },

  async create(input: CreatePersonInput, actor?: AuditActor) {
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
    const loc = await persistableLocationCodes(input);

    const entity = await personRepository.create({
      displayName,
      province: loc.province,
      district: loc.district,
      corregimiento: loc.corregimiento,
      address: input.address,
      notes: input.notes,
      sourceOrigin: input.sourceOrigin || 'MANUAL',
      createdById: actor?.userId,
      person: {
        firstName: input.firstName,
        lastName: input.lastName,
        secondLastName: input.secondLastName,
        cedula: input.cedula,
        gender: input.gender as Prisma.PersonCreateWithoutEntityInput['gender'],
        birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
        nationalityCode: input.nationalityCode ?? DEFAULT_NATIONALITY_CODE,
        educationLevel: input.educationLevel,
        occupation: input.occupation,
        businessName: input.businessName,
        economicActivity: input.economicActivity,
        hasArtisanCard: input.hasArtisanCard,
      },
      contacts: input.contacts,
    });

    await auditService.log({
      action: 'CREATE',
      entityType: 'PERSON',
      entityId: entity.id,
      entityLabel: entity.displayName,
      userId: actor?.userId,
      userEmail: actor?.userEmail,
    });

    return entity;
  },

  async update(entityId: string, input: UpdatePersonInput, actor?: AuditActor) {
    const current = await personRepository.findById(entityId);
    if (!current) {
      throw new NotFoundError('Persona', entityId);
    }

    if (input.cedula && input.cedula !== current.person?.cedula) {
      const existing = await personRepository.findByCedula(input.cedula);
      if (existing && existing.id !== entityId) {
        throw new ConflictError(
          `Ya existe una persona con cédula '${input.cedula}'`,
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

    const personData: Prisma.PersonUpdateWithoutEntityInput = {};
    if (input.firstName !== undefined) personData.firstName = input.firstName;
    if (input.lastName !== undefined) personData.lastName = input.lastName;
    if (input.secondLastName !== undefined) personData.secondLastName = input.secondLastName;
    if (input.cedula !== undefined) personData.cedula = input.cedula;
    if (input.gender !== undefined) personData.gender = input.gender as Prisma.PersonUpdateWithoutEntityInput['gender'];
    if (input.birthDate !== undefined) personData.birthDate = new Date(input.birthDate);
    if (input.nationalityCode !== undefined) personData.nationalityCode = input.nationalityCode;
    if (input.educationLevel !== undefined) personData.educationLevel = input.educationLevel;
    if (input.occupation !== undefined) personData.occupation = input.occupation;
    if (input.businessName !== undefined) personData.businessName = input.businessName;
    if (input.economicActivity !== undefined) personData.economicActivity = input.economicActivity;
    if (input.hasArtisanCard !== undefined) personData.hasArtisanCard = input.hasArtisanCard;

    if (input.firstName !== undefined || input.lastName !== undefined || input.secondLastName !== undefined) {
      const firstName = input.firstName ?? current.person!.firstName;
      const lastName = input.lastName ?? current.person!.lastName;
      const secondLastName = input.secondLastName ?? current.person?.secondLastName ?? undefined;
      entityData.displayName = buildDisplayName(firstName, lastName, secondLastName);
    }

    const entity = await personRepository.update(entityId, entityData, personData);

    await auditService.log({
      action: 'UPDATE',
      entityType: 'PERSON',
      entityId: entity.id,
      entityLabel: entity.displayName,
      userId: actor?.userId,
      userEmail: actor?.userEmail,
      metadata: { fields: Object.keys(input) },
    });

    return entity;
  },

  async remove(entityId: string, actor?: AuditActor) {
    const entity = await personRepository.findById(entityId);
    if (!entity) {
      throw new NotFoundError('Persona', entityId);
    }
    const result = await personRepository.softDelete(entityId);

    await auditService.log({
      action: 'DELETE',
      entityType: 'PERSON',
      entityId: entity.id,
      entityLabel: entity.displayName,
      userId: actor?.userId,
      userEmail: actor?.userEmail,
    });

    return result;
  },
};
