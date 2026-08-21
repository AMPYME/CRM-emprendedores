/**
 * Convierte filas de staging de importación a registros de cola de verificación.
 */
import { randomUUID } from 'crypto';
import { EntityType, Prisma } from '@prisma/client';
import type { ColumnMapping, ExtractedFields } from '../imports/import.types';
import { classifyImportRow } from '../imports/mapper.service';
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
  const entityType: EntityType = kind === 'COMPANY' ? 'COMPANY' : 'PERSON';

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
