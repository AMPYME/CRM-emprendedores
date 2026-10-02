/**
 * Convierte filas de staging de importación a registros de cola de verificación.
 */
import { randomUUID } from 'crypto';
import { EntityType, Prisma } from '@prisma/client';
import type { ColumnMapping, ExtractedFields } from '../imports/import.types';
import { classifyImportRow, queueEntityType } from '../imports/mapper.service';
import { locationInputToCodes } from '../../shared/utils/division-politica';
import type { VerificationDataPayload } from './verification.types';

function getMapped(
  rawData: Record<string, unknown>,
  mapping: ColumnMapping,
  field: string
): string | undefined {
  const col = mapping[field];
  if (!col) return undefined;
  const val = rawData[col];
  return val !== null && val !== undefined ? String(val).trim() || undefined : undefined;
}

function buildDisplayName(
  entityType: EntityType,
  fields: ExtractedFields,
  rawData: Record<string, unknown>,
  mapping: ColumnMapping
): string {
  if (entityType === 'PERSON') {
    const parts = [fields.extractedFirstName, fields.extractedLastName].filter(Boolean);
    if (parts.length) return parts.join(' ');
  }
  if (entityType === 'COMPANY') {
    const legal = getMapped(rawData, mapping, 'legalName');
    if (legal) return legal;
    if (fields.extractedBusinessName) return fields.extractedBusinessName;
  }
  return fields.extractedBusinessName || fields.extractedFirstName || 'Sin nombre';
}

type StagingRowInput = {
  id: string;
  rawData: unknown;
  extractedCedula: string | null;
  extractedRuc: string | null;
  extractedFirstName: string | null;
  extractedLastName: string | null;
  extractedEmail: string | null;
  extractedPhone: string | null;
  extractedBusinessName: string | null;
};

function fieldsFromRow(row: StagingRowInput): ExtractedFields {
  return {
    extractedCedula: row.extractedCedula || undefined,
    extractedRuc: row.extractedRuc || undefined,
    extractedFirstName: row.extractedFirstName || undefined,
    extractedLastName: row.extractedLastName || undefined,
    extractedEmail: row.extractedEmail || undefined,
    extractedPhone: row.extractedPhone || undefined,
    extractedBusinessName: row.extractedBusinessName || undefined,
  };
}

function buildContacts(fields: ExtractedFields, rawData: Record<string, unknown>, mapping: ColumnMapping) {
  const contacts: VerificationDataPayload['snapshot']['contacts'] = [];
  if (fields.extractedEmail) {
    contacts.push({ contact_type: 'EMAIL', contact_value: fields.extractedEmail, label: null, is_primary: 1 });
  }
  const phone = fields.extractedPhone || getMapped(rawData, mapping, 'phone2') || getMapped(rawData, mapping, 'phone3');
  if (phone) {
    contacts.push({ contact_type: 'PHONE', contact_value: phone, label: null, is_primary: contacts.length ? 0 : 1 });
  }
  const whatsapp = getMapped(rawData, mapping, 'whatsapp');
  if (whatsapp) {
    contacts.push({ contact_type: 'WHATSAPP', contact_value: whatsapp, label: null, is_primary: 0 });
  }
  return contacts;
}

function buildPersonSnapshot(
  fields: ExtractedFields,
  rawData: Record<string, unknown>,
  mapping: ColumnMapping
) {
  return {
    intake_entity_id: '',
    cedula: fields.extractedCedula ?? null,
    first_name: fields.extractedFirstName ?? null,
    last_name: fields.extractedLastName ?? null,
    second_last_name: getMapped(rawData, mapping, 'secondLastName') ?? null,
    gender: getMapped(rawData, mapping, 'gender') ?? null,
    birth_date: getMapped(rawData, mapping, 'birthDate') ?? null,
    nationality_code: getMapped(rawData, mapping, 'nationality') ?? 'PAN',
    education_level: getMapped(rawData, mapping, 'educationLevel') ?? null,
    occupation: getMapped(rawData, mapping, 'occupation') ?? null,
    business_name: fields.extractedBusinessName ?? null,
    economic_activity: getMapped(rawData, mapping, 'economicActivity') ?? null,
    has_artisan_card: null,
    seed_capital: null,
    seed_capital_date: null,
  };
}

function buildCompanySnapshot(
  fields: ExtractedFields,
  rawData: Record<string, unknown>,
  mapping: ColumnMapping
) {
  return {
    intake_entity_id: '',
    ruc: fields.extractedRuc ?? null,
    dv: getMapped(rawData, mapping, 'dv') ?? null,
    legal_name:
      getMapped(rawData, mapping, 'legalName') ||
      fields.extractedBusinessName ||
      (fields.extractedRuc ? `RUC ${fields.extractedRuc}` : null),
    trade_name: getMapped(rawData, mapping, 'tradeName') ?? null,
    company_type: getMapped(rawData, mapping, 'companyType') ?? null,
    company_size_class: getMapped(rawData, mapping, 'companySizeClass') ?? null,
    economic_activity: getMapped(rawData, mapping, 'economicActivity') ?? null,
    founded_date: getMapped(rawData, mapping, 'foundedDate') ?? null,
    employee_count: null,
  };
}

export function stagingRowToVerificationCreateInput(params: {
  row: StagingRowInput;
  importBatchId: string;
  sourceType: string;
  mapping: ColumnMapping;
}): Prisma.VerificationItemCreateManyInput {
  const { row, importBatchId, sourceType, mapping } = params;
  const rawData = row.rawData as Record<string, unknown>;
  const fields = fieldsFromRow(row);

  const loc = locationInputToCodes({
    province: getMapped(rawData, mapping, 'province'),
    district: getMapped(rawData, mapping, 'district'),
    corregimiento: getMapped(rawData, mapping, 'corregimiento'),
  });

  const kind = classifyImportRow(fields);
  const entityType: EntityType = queueEntityType(kind);

  const personName = [fields.extractedFirstName, fields.extractedLastName].filter(Boolean).join(' ');
  const companyName =
    getMapped(rawData, mapping, 'legalName') || fields.extractedBusinessName || '';
  const displayName =
    kind === 'BOTH' && personName && companyName
      ? `${personName} · ${companyName}`
      : buildDisplayName(entityType, fields, rawData, mapping);
  const contacts = buildContacts(fields, rawData, mapping);

  const payload: VerificationDataPayload = {
    entityType: entityType as 'PERSON' | 'COMPANY',
    sourceType,
    snapshot: {
      entityType: entityType as 'PERSON' | 'COMPANY',
      location: {
        province: loc.province ?? getMapped(rawData, mapping, 'province') ?? null,
        district: loc.district ?? getMapped(rawData, mapping, 'district') ?? null,
        corregimiento: loc.corregimiento ?? getMapped(rawData, mapping, 'corregimiento') ?? null,
        address: getMapped(rawData, mapping, 'address') ?? null,
      },
      notes: null,
      person: kind === 'PERSON' || kind === 'BOTH' ? buildPersonSnapshot(fields, rawData, mapping) : null,
      company: kind === 'COMPANY' || kind === 'BOTH' ? buildCompanySnapshot(fields, rawData, mapping) : null,
      contacts,
    },
    importMeta: {
      rawData,
      mapping,
      fields,
      sourceType,
      importBatchId,
    },
  };

  const searchParts = [
    fields.extractedFirstName,
    fields.extractedLastName,
    fields.extractedBusinessName,
    getMapped(rawData, mapping, 'legalName'),
    displayName,
  ].filter(Boolean);

  return {
    id: randomUUID(),
    entityType,
    source: 'IMPORT',
    status: 'PENDING',
    importBatchId,
    stagingRowId: row.id,
    data: payload as unknown as Prisma.InputJsonValue,
    province: loc.province ?? undefined,
    district: loc.district ?? undefined,
    corregimiento: loc.corregimiento ?? undefined,
    displayName,
    searchCedula: fields.extractedCedula ?? undefined,
    searchRuc: fields.extractedRuc ?? undefined,
    searchText: searchParts.join(' ').slice(0, 500) || undefined,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'n/a') {
    return undefined;
  }
  return trimmed;
}

function pickText(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = text(obj[key]);
    if (value) return value;
  }
  return undefined;
}

function splitPersonName(displayName: string | null | undefined): { first?: string; last?: string } {
  const primary = (displayName ?? '').split('·')[0]?.trim() ?? '';
  const parts = primary.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { first: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

/**
 * Arma el snapshot que se precarga al reclamar un ítem.
 * Completa huecos del JSON con las columnas de la cola (nombre, cédula, RUC).
 */
export function buildVerificationSeedSnapshot(item: {
  entityType: string;
  displayName: string | null;
  searchCedula: string | null;
  searchRuc: string | null;
  province: string | null;
  district: string | null;
  corregimiento: string | null;
  data: unknown;
}): {
  entityType: 'PERSON' | 'COMPANY';
  snapshot: {
    location: {
      province?: string;
      district?: string;
      corregimiento?: string;
      address?: string;
    };
    notes: string | null;
    person: Record<string, unknown> | null;
    company: Record<string, unknown> | null;
    contacts: unknown;
  };
} {
  const payload = asRecord(item.data);
  const snap = asRecord(payload.snapshot);
  const personSrc = asRecord(snap.person);
  const companySrc = asRecord(snap.company);
  const loc = asRecord(snap.location);
  const fields = asRecord(asRecord(payload.importMeta).fields);
  const entityType: 'PERSON' | 'COMPANY' =
    text(payload.entityType)?.toUpperCase() === 'COMPANY' || item.entityType === 'COMPANY'
      ? 'COMPANY'
      : 'PERSON';
  const names = splitPersonName(item.displayName);
  const companyFromLabel = (item.displayName ?? '').includes('·')
    ? text((item.displayName ?? '').split('·').slice(1).join('·'))
    : undefined;

  const firstName =
    pickText(personSrc, 'first_name', 'firstName') ??
    text(fields.extractedFirstName) ??
    (entityType === 'PERSON' ? names.first : undefined);
  const lastName =
    pickText(personSrc, 'last_name', 'lastName') ??
    text(fields.extractedLastName) ??
    (entityType === 'PERSON' ? names.last : undefined);
  const cedula =
    pickText(personSrc, 'cedula', 'document_number', 'documentNumber') ??
    text(fields.extractedCedula) ??
    text(item.searchCedula);

  const hasPerson = !!(
    firstName ||
    lastName ||
    cedula ||
    pickText(personSrc, 'second_last_name', 'secondLastName')
  );

  const explicitCompany = Object.keys(companySrc).length > 0;
  const legalName =
    pickText(companySrc, 'legal_name', 'legalName') ??
    (explicitCompany ? text(fields.extractedBusinessName) : undefined) ??
    companyFromLabel ??
    (entityType === 'COMPANY' ? text(item.displayName) ?? text(fields.extractedBusinessName) : undefined);
  const ruc = pickText(companySrc, 'ruc') ?? text(fields.extractedRuc) ?? text(item.searchRuc);
  const tradeName = pickText(companySrc, 'trade_name', 'tradeName');
  const hasCompany = !!(legalName || ruc || tradeName);

  return {
    entityType,
    snapshot: {
      location: {
        province: pickText(loc, 'province') ?? text(item.province),
        district: pickText(loc, 'district') ?? text(item.district),
        corregimiento: pickText(loc, 'corregimiento') ?? text(item.corregimiento),
        address: pickText(loc, 'address'),
      },
      notes: pickText(snap, 'notes') ?? null,
      person: hasPerson
        ? {
            cedula,
            document_number: cedula,
            first_name: firstName,
            last_name: lastName,
            second_last_name: pickText(personSrc, 'second_last_name', 'secondLastName'),
            gender: pickText(personSrc, 'gender'),
            birth_date: pickText(personSrc, 'birth_date', 'birthDate'),
            nationality_code: pickText(personSrc, 'nationality_code', 'nationalityCode'),
            education_level: pickText(personSrc, 'education_level', 'educationLevel'),
            occupation: pickText(personSrc, 'occupation'),
            business_name:
              pickText(personSrc, 'business_name', 'businessName') ?? text(fields.extractedBusinessName),
            economic_activity: pickText(personSrc, 'economic_activity', 'economicActivity'),
            has_artisan_card: personSrc.has_artisan_card ?? personSrc.hasArtisanCard,
          }
        : null,
      company: hasCompany
        ? {
            ruc,
            dv: pickText(companySrc, 'dv'),
            legal_name: legalName,
            trade_name: tradeName,
            company_type: pickText(companySrc, 'company_type', 'companyType'),
            company_size_class: pickText(companySrc, 'company_size_class', 'companySizeClass'),
            economic_activity: pickText(companySrc, 'economic_activity', 'economicActivity'),
            founded_date: pickText(companySrc, 'founded_date', 'foundedDate'),
          }
        : null,
      contacts: snap.contacts,
    },
  };
}
