/**
 * Mapeo snapshot de intake temporal → modelos Prisma del CRM.
 */
import { Gender, ContactType, CompanySizeClass } from '@prisma/client';
import {
  IntakeSnapshot,
  IntakePersonRow,
  IntakeCompanyRow,
  IntakeContactRow,
} from './intake.types';
import { locationInputToCodes } from '../../shared/utils/division-politica';
import { resolveNationalityCode } from '../../shared/utils/nationality';

const CONTACT_TYPES: ContactType[] = [
  'EMAIL', 'PHONE', 'MOBILE', 'WHATSAPP', 'WEBSITE', 'SOCIAL_MEDIA', 'OTHER',
];

function clean(v: string | null | undefined): string | undefined {
  if (v === null || v === undefined) return undefined;
  const t = String(v).trim();
  return t === '' ? undefined : t;
}

function toDate(v: string | null | undefined): Date | undefined {
  const s = clean(v);
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

function normalizeGender(v: string | null | undefined): Gender | undefined {
  const s = clean(v)?.toUpperCase();
  return s === 'MALE' || s === 'FEMALE' || s === 'OTHER' ? (s as Gender) : undefined;
}

function normalizeContactType(v: string): ContactType {
  const up = (v || '').toUpperCase() as ContactType;
  return CONTACT_TYPES.includes(up) ? up : 'OTHER';
}

function parseBoolean(v: boolean | string | null | undefined): boolean | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'true' || s === 'si' || s === 'sí' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === 'no' || s === '0') return false;
  return undefined;
}

export function hasPerson(p: IntakePersonRow | null): p is IntakePersonRow {
  return !!(p && (clean(p.first_name) || clean(p.last_name) || clean(p.cedula)));
}

export function hasCompany(c: IntakeCompanyRow | null): c is IntakeCompanyRow {
  return !!(c && (clean(c.legal_name) || clean(c.ruc) || clean(c.trade_name)));
}

export function mapContacts(contacts: IntakeContactRow[]) {
  return (contacts || [])
    .map((c) => {
      const value = clean(c.contact_value);
      if (!value) return null;
      return {
        contactType: normalizeContactType(c.contact_type),
        contactValue: value,
        label: clean(c.label),
        isPrimary: !!c.is_primary,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
}

export function entityCommon(s: IntakeSnapshot) {
  const codes = locationInputToCodes(s.location);
  return {
    province: clean(codes.province),
    district: clean(codes.district),
    corregimiento: clean(codes.corregimiento),
    address: clean(s.location.address),
    notes: clean(s.notes),
    sourceOrigin: 'EMPRENDEDORES_INTAKE',
  };
}

export function snapshotToCreatePerson(s: IntakeSnapshot) {
  const p = s.person!;
  const contacts = mapContacts(s.contacts);
  const common = entityCommon(s);
  return {
    firstName: clean(p.first_name) || 'Sin nombre',
    lastName: clean(p.last_name) || 'Sin apellido',
    secondLastName: clean(p.second_last_name),
    cedula: clean(p.cedula),
    gender: normalizeGender(p.gender),
    birthDate: clean(p.birth_date),
    nationalityCode: resolveNationalityCode(p.nationality_code),
    educationLevel: clean(p.education_level),
    hasArtisanCard: parseBoolean(p.has_artisan_card),
    province: common.province,
    district: common.district,
    corregimiento: common.corregimiento,
    address: common.address,
    notes: common.notes,
    sourceOrigin: 'EMPRENDEDORES_INTAKE',
    contacts: contacts.length ? contacts : undefined,
  };
}

export function snapshotToCreateCompany(s: IntakeSnapshot) {
  const c = s.company!;
  const contacts = mapContacts(s.contacts);
  const common = entityCommon(s);
  const sizeClass = clean(c.company_size_class) as CompanySizeClass | undefined;
  return {
    legalName: clean(c.legal_name) || clean(c.trade_name) || 'Empresa sin nombre',
    tradeName: clean(c.trade_name),
    ruc: clean(c.ruc),
    dv: clean(c.dv),
    companyType: clean(c.company_type),
    companySizeClass:
      sizeClass === 'MICRO' || sizeClass === 'PEQUENA' || sizeClass === 'MEDIANA'
        ? sizeClass
        : undefined,
    foundedDate: clean(c.founded_date),
    province: common.province,
    district: common.district,
    corregimiento: common.corregimiento,
    address: common.address,
    notes: common.notes,
    sourceOrigin: 'EMPRENDEDORES_INTAKE',
    contacts: contacts.length ? contacts : undefined,
  };
}

export function validateSnapshot(s: IntakeSnapshot): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!hasPerson(s.person) && !hasCompany(s.company)) {
    errors.push('No hay datos de persona ni empresa.');
  }
  if (hasPerson(s.person) && !clean(s.person.first_name)) {
    errors.push('Falta el nombre.');
  }
  if (
    hasCompany(s.company) &&
    !clean(s.company.legal_name) &&
    !clean(s.company.trade_name) &&
    !clean(s.company.ruc)
  ) {
    errors.push('Falta la razón social o el nombre de la empresa.');
  }
  return { valid: errors.length === 0, errors };
}

export { parseBoolean };
