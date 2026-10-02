/**
 * Escritura del snapshot temporal de intake en PostgreSQL.
 */
import { ContactType, Gender, Prisma, CompanySizeClass } from '@prisma/client';
import { prisma } from '../../config/database';
import { IntakeEntityType } from './intake.types';
import { DEFAULT_NATIONALITY_CODE, resolveNationalityCode } from '../../shared/utils/nationality';
import { ttlExpiresAtForSession } from './intake-ttl';
import { parseBoolean } from './intake.mapper';
import { locationInputToCodes } from '../../shared/utils/division-politica';

export interface IntakeUpdateBody {
  person?: Record<string, string | boolean | undefined>;
  company?: Record<string, string | number | undefined>;
  location?: Record<string, string | undefined>;
  contacts?: Array<{
    contactType: string;
    contactValue: string;
    label?: string;
    isPrimary?: boolean;
  }>;
  notes?: string;
}

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

function clip(v: unknown, max: number): string | null {
  const s = clean(v);
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function parseDate(v: unknown): Date | null {
  const s = clean(v);
  if (!s) return null;
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  let d: Date;
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
      return null;
    }
  } else {
    d = new Date(s);
  }
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  if (year < 1900 || year > 2100) return null;
  return d;
}

function toGender(v: unknown): Gender | null {
  const s = (clean(v) ?? '').toUpperCase();
  if (['MALE', 'M', 'H', 'HOMBRE', 'MASCULINO'].includes(s)) return 'MALE';
  if (['FEMALE', 'F', 'MUJER', 'FEMENINO'].includes(s)) return 'FEMALE';
  if (s === 'OTHER' || s === 'OTRO' || s === 'OTRA') return 'OTHER';
  return null;
}

const CONTACT_TYPES: ContactType[] = [
  'EMAIL',
  'PHONE',
  'MOBILE',
  'WHATSAPP',
  'WEBSITE',
  'SOCIAL_MEDIA',
  'OTHER',
];

function toContactType(value: string | undefined): ContactType {
  const type = (value || 'OTHER').toUpperCase() as ContactType;
  return CONTACT_TYPES.includes(type) ? type : 'OTHER';
}

function toSizeClass(v: unknown): CompanySizeClass | null {
  const s = clean(v)?.toUpperCase();
  if (s === 'MICRO' || s === 'PEQUENA' || s === 'MEDIANA') return s;
  return null;
}

export async function replaceIntakeSnapshot(
  sessionId: string,
  entityType: IntakeEntityType,
  body: IntakeUpdateBody,
  currentStatus: 'DRAFT' | 'SUBMITTED' | 'VALIDATED' | 'EXPIRED'
): Promise<void> {
  const person = body.person ?? {};
  const company = body.company ?? {};
  const location = body.location ?? {};
  const contacts = body.contacts ?? [];
  const notes = clean(body.notes);
  const locCodes = locationInputToCodes(location);

  await prisma.$transaction(async (tx) => {
    // Soft-delete (el middleware bloquea deleteMany físico en IntakeEntity)
    await tx.intakeEntity.updateMany({
      where: { sessionId },
      data: { deletedAt: new Date() },
    });

    const entityData: Prisma.IntakeEntityCreateInput = {
      session: { connect: { id: sessionId } },
      entityType,
      province: clip(locCodes.province || clean(location.province), 120),
      district: clip(locCodes.district || clean(location.district), 120),
      corregimiento: clip(locCodes.corregimiento || clean(location.corregimiento), 120),
      address: clean(location.address),
      notes,
      sourceOrigin: 'EMPRENDEDORES_INTAKE',
    };

    const contactCreates = contacts
      .map((c) => {
        const val = clean(c.contactValue);
        if (!val) return null;
        return {
          contactType: toContactType(c.contactType),
          contactValue: val,
          label: clean(c.label),
          isPrimary: !!c.isPrimary,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    const hasPersonData = !!(
      clean(person.firstName) ||
      clean(person.lastName) ||
      clean(person.cedula) ||
      clean(person.documentNumber)
    );
    const hasCompanyData = !!(
      clean(company.legalName) ||
      clean(company.tradeName) ||
      clean(company.ruc)
    );
    const createPerson = hasPersonData || (entityType === 'PERSON' && !hasCompanyData);
    const createCompany = hasCompanyData || (entityType === 'COMPANY' && !hasPersonData);

    if (createPerson) {
      const firstName = clip(person.firstName, 120);
      const lastName = clip(person.lastName, 120);
      const displayName = clip(
        [firstName, lastName].filter(Boolean).join(' ') || 'Sin nombre',
        255
      );
      const gender = toGender(person.gender);
      const hasArtisanCard = parseBoolean(person.hasArtisanCard);
      const cedula = clip(person.documentNumber, 40) ?? clip(person.cedula, 40);

      await tx.intakeEntity.create({
        data: {
          ...entityData,
          entityType: 'PERSON',
          displayName,
          person: {
            create: {
              cedula,
              firstName,
              lastName,
              secondLastName: clip(person.secondLastName, 120),
              gender,
              birthDate: parseDate(person.birthDate),
              nationalityCode: resolveNationalityCode(
                clean(person.nationalityCode) ?? DEFAULT_NATIONALITY_CODE
              ),
              educationLevel: clip(person.educationLevel, 120),
              occupation: clip(person.occupation, 160),
              businessName: clip(person.businessName, 200),
              economicActivity: clip(person.economicActivity, 200),
              hasArtisanCard: hasArtisanCard ?? null,
            },
          },
          contacts: contactCreates.length ? { create: contactCreates } : undefined,
        },
      });
    }

    if (createCompany) {
      const legalName =
        clip(company.legalName, 200) ??
        clip(company.tradeName, 200) ??
        'Empresa sin nombre';
      const tradeName = clip(company.tradeName, 200);
      const displayName = clip(tradeName ?? legalName, 255);
      const economicActivity = clip(company.economicActivity, 200);

      await tx.intakeEntity.create({
        data: {
          ...entityData,
          entityType: 'COMPANY',
          displayName,
          company: {
            create: {
              ruc: clip(company.ruc, 60),
              dv: clip(company.dv, 10),
              legalName,
              tradeName,
              companyType: clip(company.companyType, 80),
              companySizeClass: toSizeClass(company.companySizeClass),
              economicActivity,
              foundedDate: parseDate(company.foundedDate ?? company.foundedDate),
            },
          },
          contacts:
            contactCreates.length && !hasPersonData
              ? { create: contactCreates }
              : undefined,
        },
      });
    }

    const expiresAt = await ttlExpiresAtForSession(sessionId);
    await tx.intakeSession.update({
      where: { id: sessionId },
      data: {
        status: currentStatus === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT',
        lastActivityAt: new Date(),
        expiresAt,
      },
    });
  });
}

export async function markIntakeSubmitted(sessionId: string): Promise<void> {
  const expiresAt = await ttlExpiresAtForSession(sessionId);
  await prisma.intakeSession.update({
    where: { id: sessionId },
    data: {
      status: 'SUBMITTED',
      lastActivityAt: new Date(),
      expiresAt,
    },
  });
}

function textField(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = clean(obj[key]);
    if (value) return value;
  }
  return undefined;
}

function normalizeSeedContacts(raw: unknown): IntakeUpdateBody['contacts'] {
  if (!Array.isArray(raw)) return [];
  const contacts: NonNullable<IntakeUpdateBody['contacts']> = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const contactValue = textField(row, 'contact_value', 'contactValue');
    if (!contactValue) continue;
    const primary = row.is_primary ?? row.isPrimary;
    contacts.push({
      contactType: textField(row, 'contact_type', 'contactType') ?? 'OTHER',
      contactValue,
      label: textField(row, 'label'),
      isPrimary: primary === true || primary === 1 || primary === '1',
    });
  }
  return contacts;
}

/**
 * Precarga una sesión intake desde datos de cola de verificación.
 * El operador ve el borrador en vivo por WebSocket al abrir /dashboard/intake/:id.
 */
export async function seedIntakeFromVerificationPayload(
  sessionId: string,
  entityType: IntakeEntityType,
  snapshot?: {
    location?: {
      province?: string | null;
      district?: string | null;
      corregimiento?: string | null;
      address?: string | null;
    } | null;
    notes?: string | null;
    person?: Record<string, unknown> | null;
    company?: Record<string, unknown> | null;
    contacts?: unknown;
  } | null
): Promise<void> {
  const loc = snapshot?.location ?? {};
  const personSrc = snapshot?.person ?? null;
  const companySrc = snapshot?.company ?? null;
  const body: IntakeUpdateBody = {
    location: {
      province: loc.province ?? undefined,
      district: loc.district ?? undefined,
      corregimiento: loc.corregimiento ?? undefined,
      address: loc.address ?? undefined,
    },
    notes: snapshot?.notes ?? undefined,
    contacts: normalizeSeedContacts(snapshot?.contacts),
  };

  if (personSrc) {
    body.person = {
      cedula: textField(personSrc, 'cedula'),
      documentNumber: textField(personSrc, 'document_number', 'documentNumber', 'cedula'),
      documentType: textField(personSrc, 'document_type', 'documentType'),
      firstName: textField(personSrc, 'first_name', 'firstName'),
      lastName: textField(personSrc, 'last_name', 'lastName'),
      secondLastName: textField(personSrc, 'second_last_name', 'secondLastName'),
      gender: textField(personSrc, 'gender'),
      birthDate: textField(personSrc, 'birth_date', 'birthDate'),
      nationalityCode: textField(personSrc, 'nationality_code', 'nationalityCode'),
      educationLevel: textField(personSrc, 'education_level', 'educationLevel'),
      occupation: textField(personSrc, 'occupation'),
      businessName: textField(personSrc, 'business_name', 'businessName'),
      economicActivity: textField(personSrc, 'economic_activity', 'economicActivity'),
      hasArtisanCard: (personSrc.has_artisan_card ?? personSrc.hasArtisanCard) as
        | boolean
        | undefined,
    };
  }

  if (companySrc) {
    body.company = {
      ruc: textField(companySrc, 'ruc'),
      dv: textField(companySrc, 'dv'),
      legalName: textField(companySrc, 'legal_name', 'legalName'),
      tradeName: textField(companySrc, 'trade_name', 'tradeName'),
      companyType: textField(companySrc, 'company_type', 'companyType'),
      companySizeClass: textField(companySrc, 'company_size_class', 'companySizeClass'),
      economicActivity: textField(companySrc, 'economic_activity', 'economicActivity'),
      foundedDate: textField(companySrc, 'founded_date', 'foundedDate'),
    };
  }

  await replaceIntakeSnapshot(sessionId, entityType, body, 'DRAFT');
  await markIntakeSubmitted(sessionId);
}
