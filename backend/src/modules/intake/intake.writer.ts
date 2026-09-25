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
  person?: Record<string, string | boolean | number | undefined>;
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

function parseDate(v: unknown): Date | null {
  const s = clean(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
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
    await tx.intakeEntity.deleteMany({ where: { sessionId } });

    const entityData: Prisma.IntakeEntityCreateInput = {
      session: { connect: { id: sessionId } },
      entityType,
      province: locCodes.province || clean(location.province),
      district: locCodes.district || clean(location.district),
      corregimiento: locCodes.corregimiento || clean(location.corregimiento),
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
      clean(person.firstName) ||
      clean(person.lastName) ||
      clean(person.lastName) ||
      clean(person.cedula)
    );
    const hasCompanyData = !!(
      clean(company.legalName) ||
      clean(company.legalName) ||
      clean(company.tradeName) ||
      clean(company.tradeName) ||
      clean(company.ruc)
    );
    const createPerson = hasPersonData || (entityType === 'PERSON' && !hasCompanyData);
    const createCompany = hasCompanyData || (entityType === 'COMPANY' && !hasPersonData);

    if (createPerson) {
      const firstName = clean(person.firstName) ?? clean(person.firstName);
      const lastName = clean(person.lastName) ?? clean(person.lastName);
      const displayName =
        [firstName, lastName].filter(Boolean).join(' ') || 'Sin nombre';
      const genderRaw = (clean(person.gender) ?? '').toUpperCase();
      const gender: Gender | null =
        genderRaw === 'MALE' || genderRaw === 'FEMALE' || genderRaw === 'OTHER'
          ? genderRaw
          : null;
      const hasArtisanCard = parseBoolean(
        typeof person.hasArtisanCard === 'number' ? undefined : person.hasArtisanCard
      );

      await tx.intakeEntity.create({
        data: {
          ...entityData,
          entityType: 'PERSON',
          displayName,
          person: {
            create: {
              cedula: clean(person.cedula),
              firstName,
              lastName,
              secondLastName: clean(person.secondLastName) ?? clean(person.secondLastName),
              gender,
              birthDate: parseDate(person.birthDate ?? person.birthDate),
              nationalityCode: resolveNationalityCode(
                clean(person.nationalityCode) ??
                  clean(person.nationalityCode) ??
                  DEFAULT_NATIONALITY_CODE
              ),
              educationLevel: clean(person.educationLevel) ?? clean(person.educationLevel),
              hasArtisanCard: hasArtisanCard ?? null,
              seedCapital: person.seedCapital === 1 || person.seedCapital === '1' ? 1 : person.seedCapital === 0 || person.seedCapital === '0' ? 0 : null,
              seedCapitalDate: person.seedCapital === 1 || person.seedCapital === '1' ? clean(person.seedCapitalDate) ?? null : null,
            },
          },
          contacts: contactCreates.length ? { create: contactCreates } : undefined,
        },
      });
    }

    if (createCompany) {
      const legalName =
        clean(company.legalName) ??
        clean(company.legalName) ??
        clean(company.tradeName) ??
        clean(company.tradeName) ??
        'Empresa sin nombre';
      const tradeName = clean(company.tradeName) ?? clean(company.tradeName);
      const displayName = tradeName ?? legalName;

      await tx.intakeEntity.create({
        data: {
          ...entityData,
          entityType: 'COMPANY',
          displayName,
          company: {
            create: {
              ruc: clean(company.ruc),
              dv: clean(company.dv),
              legalName,
              tradeName,
              companyType: clean(company.companyType) ?? clean(company.companyType),
              companySizeClass: toSizeClass(company.companySizeClass ?? company.companySizeClass),
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

/**
 * Precarga una sesión intake desde datos de cola de verificación.
 * El operador ve el borrador en vivo por WebSocket al abrir /dashboard/intake/:id.
 */
export async function seedIntakeFromVerificationPayload(
  sessionId: string,
  entityType: IntakeEntityType,
  snapshot: {
    location: { province?: string | null; district?: string | null; corregimiento?: string | null; address?: string | null };
    notes?: string | null;
    person?: Record<string, unknown> | null;
    company?: Record<string, unknown> | null;
    contacts?: Array<{ contact_type: string; contact_value: string; label?: string | null; is_primary?: number }>;
  }
): Promise<void> {
  const body: IntakeUpdateBody = {
    location: {
      province: snapshot.location.province ?? undefined,
      district: snapshot.location.district ?? undefined,
      corregimiento: snapshot.location.corregimiento ?? undefined,
      address: snapshot.location.address ?? undefined,
    },
    notes: snapshot.notes ?? undefined,
    contacts: (snapshot.contacts ?? []).map((c) => ({
      contactType: c.contact_type,
      contactValue: c.contact_value,
      label: c.label ?? undefined,
      isPrimary: !!c.is_primary,
    })),
  };

  if (snapshot.person) {
    body.person = {
      cedula: snapshot.person.cedula as string | undefined,
      firstName: snapshot.person.first_name as string | undefined,
      lastName: snapshot.person.last_name as string | undefined,
      secondLastName: snapshot.person.second_last_name as string | undefined,
      gender: snapshot.person.gender as string | undefined,
      birthDate: snapshot.person.birth_date as string | undefined,
      nationalityCode: snapshot.person.nationality_code as string | undefined,
      educationLevel: snapshot.person.education_level as string | undefined,
      occupation: snapshot.person.occupation as string | undefined,
      businessName: snapshot.person.business_name as string | undefined,
      economicActivity: snapshot.person.economic_activity as string | undefined,
      hasArtisanCard: snapshot.person.has_artisan_card as boolean | undefined,
      seedCapital: snapshot.person.seed_capital === 0 || snapshot.person.seed_capital === 1
        ? snapshot.person.seed_capital
        : undefined,
      seedCapitalDate: typeof snapshot.person.seed_capital_date === 'string'
        ? snapshot.person.seed_capital_date
        : undefined,
    };
  }

  if (snapshot.company) {
    body.company = {
      ruc: snapshot.company.ruc as string | undefined,
      dv: snapshot.company.dv as string | undefined,
      legalName: snapshot.company.legal_name as string | undefined,
      tradeName: snapshot.company.trade_name as string | undefined,
      companyType: snapshot.company.company_type as string | undefined,
      companySizeClass: snapshot.company.company_size_class as string | undefined,
      economicActivity: snapshot.company.economic_activity as string | undefined,
      foundedDate: snapshot.company.founded_date as string | undefined,
    };
  }

  await replaceIntakeSnapshot(sessionId, entityType, body, 'DRAFT');
  await markIntakeSubmitted(sessionId);
}
