/**
 * Service del módulo de personas.
 * Escrituras vía api.* (infrastructure/database); lecturas legacy + api.
 */
import { Prisma } from '@prisma/client';
import { personRepository } from './person.repository';
import { personApiRepository } from '../../infrastructure/database';
import { PersonQueryInput, CreatePersonInput, UpdatePersonInput, resolveDocumentFields } from './person.validator';
import { NotFoundError, ConflictError, BadRequestError } from '../../shared/errors/app-error';
import { PaginationMeta } from '../../shared/types/api-response.types';
import { titleCase } from '../../shared/utils/string.utils';
import { persistableLocationCodes } from '../../shared/utils/entity-location';
import { validateDocumentNumber } from '../../shared/utils/document.utils';
import { AuditActor } from '../audit/audit.service';
import { contactApiRepository } from '../../infrastructure/database';

function buildDisplayName(firstName: string, lastName: string, secondLastName?: string): string {
  const parts = [titleCase(firstName), titleCase(lastName)];
  if (secondLastName) parts.push(titleCase(secondLastName));
  return parts.join(' ');
}

function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
}

function politicalCodeFromLoc(loc: {
  province?: string | null;
  district?: string | null;
  corregimiento?: string | null;
}): string | null {
  return loc.corregimiento || loc.district || loc.province || null;
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
    const docs = resolveDocumentFields(input);
    const docErr = validateDocumentNumber(docs.documentType, docs.documentNumber, { required: true });
    if (docErr) throw new BadRequestError(docErr);

    if (docs.cedula) {
      const existing = await personRepository.findByCedula(docs.cedula);
      if (existing) {
        throw new ConflictError(
          `Ya existe una persona con documento '${docs.cedula}'`,
          { existingEntityId: existing.id, existingName: existing.displayName }
        );
      }
    }

    const loc = await persistableLocationCodes(input);
    const actorId = actor?.userId || null;

    let entityId: string;
    try {
      entityId = await personApiRepository.create(actorId, {
        firstName: titleCase(input.firstName),
        lastName: titleCase(input.lastName),
        secondLastName: input.secondLastName ? titleCase(input.secondLastName) : null,
        documentType: docs.documentType ?? null,
        documentNumber: docs.documentNumber ?? null,
        gender: input.gender ?? null,
        politicalDivisionCode: politicalCodeFromLoc(loc),
        addressLine: input.address ?? null,
        sourceOrigin: input.sourceOrigin || 'MANUAL',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Documento ya registrado') || msg.includes('23505')) {
        throw new ConflictError(`Ya existe una persona con documento '${docs.cedula}'`);
      }
      throw err;
    }

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

    const personData: Prisma.PersonUpdateWithoutEntityInput = {};
    if (input.birthDate) personData.birthDate = new Date(input.birthDate);
    if (input.nationalityCode) personData.nationalityCode = input.nationalityCode;
    if (input.hasArtisanCard !== undefined) personData.hasArtisanCard = input.hasArtisanCard;
    if (input.hasNoticeOfOperation !== undefined) {
      personData.hasNoticeOfOperation = input.hasNoticeOfOperation;
    }
    if (input.educationLevel) personData.educationLevel = input.educationLevel;
    if (input.occupation) personData.occupation = input.occupation;
    if (input.businessName) personData.businessName = input.businessName;
    if (input.economicActivity) personData.economicActivity = input.economicActivity;

    const locationData: Prisma.EntityUncheckedUpdateInput = {
      province: loc.province ?? null,
      district: loc.district ?? null,
      corregimiento: loc.corregimiento ?? null,
      politicalDivisionCode: politicalCodeFromLoc(loc),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.economicActivity !== undefined
        ? { actEc: input.economicActivity.trim() || null }
        : {}),
    };
    try {
      await personRepository.update(entityId, locationData, personData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('entities_political_division_code_fkey') && !msg.includes('23503')) {
        throw err;
      }
      const withoutPoliticalCode = { ...locationData };
      delete withoutPoliticalCode.politicalDivisionCode;
      await personRepository.update(entityId, withoutPoliticalCode, personData);
    }

    const entity = await personRepository.findById(entityId);
    if (!entity) throw new NotFoundError('Persona', entityId);
    return entity;
  },

  async update(entityId: string, input: UpdatePersonInput, actor?: AuditActor) {
    const current = await personRepository.findById(entityId);
    if (!current) {
      throw new NotFoundError('Persona', entityId);
    }

    const loc =
      input.province !== undefined ||
      input.district !== undefined ||
      input.corregimiento !== undefined
        ? await persistableLocationCodes({
            province: input.province ?? current.province,
            district: input.district ?? current.district,
            corregimiento: input.corregimiento ?? current.corregimiento,
          })
        : null;

    let documentType: string | null | undefined;
    let documentNumber: string | null | undefined;
    if (input.cedula !== undefined || input.documentNumber !== undefined || input.documentType !== undefined) {
      const docs = resolveDocumentFields({
        documentType:
          input.documentType ??
          (current.person?.documentType as CreatePersonInput['documentType']) ??
          undefined,
        documentNumber: input.documentNumber ?? input.cedula ?? current.person?.documentNumber ?? undefined,
        cedula: input.cedula,
      });
      const docErr = validateDocumentNumber(docs.documentType, docs.documentNumber);
      if (docErr) throw new BadRequestError(docErr);
      documentType = docs.documentType ?? null;
      documentNumber = docs.documentNumber ?? null;
    }

    const actorId = actor?.userId || null;
    await personApiRepository.update(actorId, entityId, {
      firstName: input.firstName !== undefined ? titleCase(input.firstName) : undefined,
      lastName: input.lastName !== undefined ? titleCase(input.lastName) : undefined,
      secondLastName:
        input.secondLastName !== undefined
          ? input.secondLastName
            ? titleCase(input.secondLastName)
            : null
          : undefined,
      documentType,
      documentNumber,
      politicalDivisionCode: loc ? politicalCodeFromLoc(loc) : undefined,
      addressLine: input.address !== undefined ? input.address : undefined,
    });

    // Campos aún no cubiertos por sp_update_person (notes, economicActivity, etc.)
    const personData: Prisma.PersonUpdateWithoutEntityInput = {};
    const entityData: Prisma.EntityUncheckedUpdateInput = {};
    if (input.notes !== undefined) entityData.notes = input.notes;
    if (input.economicActivity !== undefined) {
      entityData.actEc = input.economicActivity?.trim() || null;
      personData.economicActivity = input.economicActivity;
    }
    if (input.gender !== undefined) personData.gender = input.gender as Prisma.PersonUpdateWithoutEntityInput['gender'];
    if (input.birthDate !== undefined) personData.birthDate = new Date(input.birthDate);
    if (input.nationalityCode !== undefined) personData.nationalityCode = input.nationalityCode;
    if (input.educationLevel !== undefined) personData.educationLevel = input.educationLevel;
    if (input.occupation !== undefined) personData.occupation = input.occupation;
    if (input.businessName !== undefined) {
      personData.businessName = input.businessName;
      personData.legacyBusinessName = input.businessName;
    }
    if (input.hasArtisanCard !== undefined) personData.hasArtisanCard = input.hasArtisanCard;
    if (input.hasNoticeOfOperation !== undefined) {
      personData.hasNoticeOfOperation = input.hasNoticeOfOperation;
    }
    if (loc) {
      entityData.province = loc.province ?? null;
      entityData.district = loc.district ?? null;
      entityData.corregimiento = loc.corregimiento ?? null;
    }

    if (Object.keys(personData).length || Object.keys(entityData).length) {
      await personRepository.update(entityId, entityData, personData);
    }

    void buildDisplayName;
    const entity = await personRepository.findById(entityId);
    if (!entity) throw new NotFoundError('Persona', entityId);
    return entity;
  },

  async remove(entityId: string, actor?: AuditActor) {
    const entity = await personRepository.findById(entityId);
    if (!entity) {
      throw new NotFoundError('Persona', entityId);
    }
    await personApiRepository.softDelete(actor?.userId || null, entityId);
    return entity;
  },
};
