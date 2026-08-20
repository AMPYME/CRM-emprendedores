/**
 * Escritura del snapshot temporal de intake en PostgreSQL.
 */
import { ContactType, Gender, Prisma, CompanySizeClass } from '@prisma/client';
import { prisma } from '../../config/database';
import { IntakeEntityType } from './intake.types';
import { DEFAULT_NATIONALITY_CODE, resolveNationalityCode } from '../../shared/utils/nationality';
import { ttlExpiresAt } from './intake-ttl';
import { parseBoolean } from './intake.mapper';

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

  await prisma.$transaction(async (tx) => {
    await tx.intakeEntity.deleteMany({ where: { sessionId } });

    const entityData: Prisma.IntakeEntityCreateInput = {
      session: { connect: { id: sessionId } },
      entityType,
      province: clean(location.province),
      district: clean(location.district),
      corregimiento: clean(location.corregimiento),
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

    if (entityType === 'PERSON') {
      const displayName =
        [clean(person.firstName), clean(person.lastName)].filter(Boolean).join(' ') || 'Sin nombre';
      const genderRaw = clean(person.gender)?.toUpperCase();
      const gender: Gender | null =
        genderRaw === 'MALE' || genderRaw === 'FEMALE' || genderRaw === 'OTHER'
          ? genderRaw
          : null;
      const hasArtisanCard = parseBoolean(person.hasArtisanCard);

      await tx.intakeEntity.create({
        data: {
          ...entityData,
          displayName,
          person: {
            create: {
              cedula: clean(person.cedula),
              firstName: clean(person.firstName),
              lastName: clean(person.lastName),
              secondLastName: clean(person.secondLastName),
              gender,
              birthDate: parseDate(person.birthDate),
              nationalityCode: resolveNationalityCode(
                clean(person.nationalityCode) ?? DEFAULT_NATIONALITY_CODE
              ),
              educationLevel: clean(person.educationLevel),
              hasArtisanCard: hasArtisanCard ?? null,
            },
          },
          contacts: contactCreates.length ? { create: contactCreates } : undefined,
        },
      });
    } else if (entityType === 'COMPANY') {
      const displayName =
        clean(company.tradeName) ?? clean(company.legalName) ?? 'Empresa sin nombre';

      await tx.intakeEntity.create({
        data: {
          ...entityData,
          displayName,
          company: {
            create: {
              ruc: clean(company.ruc),
              dv: clean(company.dv),
              legalName: clean(company.legalName),
              tradeName: clean(company.tradeName),
              companyType: clean(company.companyType),
              companySizeClass: toSizeClass(company.companySizeClass),
              foundedDate: parseDate(company.foundedDate),
            },
          },
          contacts: contactCreates.length ? { create: contactCreates } : undefined,
        },
      });
    }

    await tx.intakeSession.update({
      where: { id: sessionId },
      data: {
        status: currentStatus === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT',
        lastActivityAt: new Date(),
        expiresAt: ttlExpiresAt(),
      },
    });
  });
}

export async function markIntakeSubmitted(sessionId: string): Promise<void> {
  await prisma.intakeSession.update({
    where: { id: sessionId },
    data: {
      status: 'SUBMITTED',
      lastActivityAt: new Date(),
      expiresAt: ttlExpiresAt(),
    },
  });
}

/** Precarga una sesión intake desde datos de cola de verificación (sin WebSocket previo). */
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
