/**
 * Escritura del snapshot temporal de intake en PostgreSQL.
 */
import { ContactType, Gender, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { IntakeEntityType } from './intake.types';
import { DEFAULT_NATIONALITY_CODE, resolveNationalityCode } from '../../shared/utils/nationality';
import { ttlExpiresAt } from './intake-ttl';

export interface IntakeUpdateBody {
  person?: Record<string, string | undefined>;
  company?: Record<string, string | number | undefined>;
  establishment?: Record<string, string | number | undefined>;
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

export async function replaceIntakeSnapshot(
  sessionId: string,
  entityType: IntakeEntityType,
  body: IntakeUpdateBody,
  currentStatus: 'DRAFT' | 'SUBMITTED' | 'VALIDATED' | 'EXPIRED'
): Promise<void> {
  const person = body.person ?? {};
  const company = body.company ?? {};
  const establishment = body.establishment ?? {};
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
            },
          },
          contacts: contactCreates.length ? { create: contactCreates } : undefined,
        },
      });
    } else if (entityType === 'COMPANY') {
      const displayName =
        clean(company.tradeName) ?? clean(company.legalName) ?? 'Empresa sin nombre';
      const employeeCount =
        company.employeeCount !== undefined && company.employeeCount !== ''
          ? parseInt(String(company.employeeCount), 10)
          : null;

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
              economicActivity: clean(company.economicActivity),
              foundedDate: parseDate(company.foundedDate),
              employeeCount: Number.isFinite(employeeCount) ? employeeCount : null,
            },
          },
          contacts: contactCreates.length ? { create: contactCreates } : undefined,
        },
      });
    } else if (entityType === 'ESTABLISHMENT') {
      const displayName = clean(establishment.establishmentName) ?? 'Establecimiento sin nombre';

      await tx.intakeEntity.create({
        data: {
          ...entityData,
          displayName,
          establishment: {
            create: {
              establishmentName: clean(establishment.establishmentName),
              establishmentType: clean(establishment.establishmentType),
              economicActivity: clean(establishment.economicActivity),
              noticeOfOperation: clean(establishment.noticeOfOperation),
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
