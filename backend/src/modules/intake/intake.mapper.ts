/**
 * Mapeo snapshot de intake temporal → modelos Prisma del CRM.
 */
import { Gender, ContactType } from '@prisma/client';
import {
  IntakeSnapshot,
  IntakePersonRow,
  IntakeCompanyRow,
  IntakeEstablishmentRow,
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

export function hasPerson(p: IntakePersonRow | null): p is IntakePersonRow {
  return !!(p && (clean(p.first_name) || clean(p.last_name) || clean(p.cedula)));
}

export function hasCompany(c: IntakeCompanyRow | null): c is IntakeCompanyRow {
  return !!(c && (clean(c.legal_name) || clean(c.ruc) || clean(c.trade_name)));
}

export function hasEstablishment(e: IntakeEstablishmentRow | null): e is IntakeEstablishmentRow {
  return !!(e && clean(e.establishment_name));
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

export function personDisplayName(p: IntakePersonRow): string {
  const parts = [clean(p.first_name), clean(p.last_name)].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Sin nombre';
}

export function companyDisplayName(c: IntakeCompanyRow): string {
  return clean(c.trade_name) || clean(c.legal_name) || 'Empresa sin nombre';
}

export function establishmentDisplayName(e: IntakeEstablishmentRow): string {
  return clean(e.establishment_name) || 'Establecimiento sin nombre';
}

/** Location en intake y Entity PostgreSQL = códigos del catálogo. */
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

export function personCreate(p: IntakePersonRow) {
  return {
    firstName: clean(p.first_name) || 'Sin nombre',
    lastName: clean(p.last_name) || 'Sin apellido',
    secondLastName: clean(p.second_last_name),
    cedula: clean(p.cedula),
    gender: normalizeGender(p.gender),
    birthDate: toDate(p.birth_date),
    nationalityCode: resolveNationalityCode(p.nationality_code),
    educationLevel: clean(p.education_level),
    occupation: clean(p.occupation),
    businessName: clean(p.business_name),
    economicActivity: clean(p.economic_activity),
  };
}

export function companyCreate(c: IntakeCompanyRow) {
  return {
    legalName: clean(c.legal_name) || clean(c.trade_name) || 'Empresa sin nombre',
    ruc: clean(c.ruc),
    dv: clean(c.dv),
    tradeName: clean(c.trade_name),
    companyType: clean(c.company_type),
    economicActivity: clean(c.economic_activity),
    foundedDate: toDate(c.founded_date),
    employeeCount:
      c.employee_count !== null && c.employee_count !== undefined
        ? Number(c.employee_count) || undefined
        : undefined,
  };
}

export function establishmentCreate(e: IntakeEstablishmentRow) {
  return {
    establishmentName: clean(e.establishment_name) || 'Establecimiento sin nombre',
    establishmentType: clean(e.establishment_type),
    economicActivity: clean(e.economic_activity),
    noticeOfOperation: clean(e.notice_of_operation),
    latitude: e.latitude ?? undefined,
    longitude: e.longitude ?? undefined,
  };
}

/** Snapshot temporal → payload de creación en PostgreSQL (misma forma que los modales del CRM). */
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
  return {
    legalName: clean(c.legal_name) || clean(c.trade_name) || 'Empresa sin nombre',
    tradeName: clean(c.trade_name),
    ruc: clean(c.ruc),
    dv: clean(c.dv),
    companyType: clean(c.company_type),
    economicActivity: clean(c.economic_activity),
    foundedDate: clean(c.founded_date),
    employeeCount:
      c.employee_count !== null && c.employee_count !== undefined
        ? Number(c.employee_count) || undefined
        : undefined,
    province: common.province,
    district: common.district,
    corregimiento: common.corregimiento,
    address: common.address,
    notes: common.notes,
    sourceOrigin: 'EMPRENDEDORES_INTAKE',
    contacts: contacts.length ? contacts : undefined,
  };
}

export function snapshotToCreateEstablishment(s: IntakeSnapshot) {
  const e = s.establishment!;
  const contacts = mapContacts(s.contacts);
  const common = entityCommon(s);
  return {
    establishmentName: clean(e.establishment_name) || 'Establecimiento sin nombre',
    establishmentType: clean(e.establishment_type),
    economicActivity: clean(e.economic_activity),
    noticeOfOperation: clean(e.notice_of_operation),
    province: common.province,
    district: common.district,
    corregimiento: common.corregimiento,
    address: common.address,
    notes: common.notes,
    sourceOrigin: 'EMPRENDEDORES_INTAKE',
    contacts: contacts.length ? contacts : undefined,
  };
}

/** Valida que el snapshot tenga datos suficientes para migrar. */
export function validateSnapshot(s: IntakeSnapshot): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (s.entityType === 'PERSON') {
    if (!hasPerson(s.person)) errors.push('No hay datos de persona.');
    else {
      if (!clean(s.person.first_name)) errors.push('Falta el nombre.');
      if (!clean(s.person.last_name)) errors.push('Falta el apellido.');
    }
  } else if (s.entityType === 'COMPANY') {
    if (!hasCompany(s.company)) errors.push('No hay datos de empresa.');
    else if (!clean(s.company.legal_name)) errors.push('Falta la razón social.');
  } else if (s.entityType === 'ESTABLISHMENT') {
    if (!hasEstablishment(s.establishment)) errors.push('No hay datos del establecimiento.');
    else if (!clean(s.establishment.establishment_name)) {
      errors.push('Falta el nombre del establecimiento.');
    }
  }
  return { valid: errors.length === 0, errors };
}
