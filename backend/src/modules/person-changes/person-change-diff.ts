/**
 * Snapshot plano de persona para comparar Dato anterior / Dato nuevo en confirmaciones.
 */
type PersonEntitySnapshot = {
  displayName?: string | null;
  province?: string | null;
  district?: string | null;
  corregimiento?: string | null;
  address?: string | null;
  notes?: string | null;
  person?: {
    firstName?: string | null;
    lastName?: string | null;
    secondLastName?: string | null;
    documentType?: string | null;
    documentNumber?: string | null;
    cedula?: string | null;
    gender?: string | null;
    birthDate?: Date | string | null;
    nationalityCode?: string | null;
    educationLevel?: string | null;
    occupation?: string | null;
    businessName?: string | null;
    economicActivity?: string | null;
    hasArtisanCard?: boolean | null;
  } | null;
  contacts?: Array<{
    contactType?: string | null;
    contactValue?: string | null;
  }> | null;
};

export type ChangeDiffPayload = {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  apply: unknown;
};

function dateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.includes('T') ? s.split('T')[0]! : s || null;
}

function emptyToNull(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

/** Campos escalares de persona/entidad para la UI de confirmación. */
export function snapshotPersonFields(entity: PersonEntitySnapshot): Record<string, unknown> {
  const p = entity.person;
  const email = entity.contacts?.find((c) => c.contactType === 'EMAIL')?.contactValue ?? null;
  const phone =
    entity.contacts?.find((c) => c.contactType === 'MOBILE' || c.contactType === 'PHONE')
      ?.contactValue ?? null;

  return {
    firstName: p?.firstName ?? null,
    lastName: p?.lastName ?? null,
    secondLastName: p?.secondLastName ?? null,
    documentType: p?.documentType ?? null,
    documentNumber: p?.documentNumber ?? p?.cedula ?? null,
    gender: p?.gender ?? null,
    birthDate: dateOnly(p?.birthDate),
    nationalityCode: p?.nationalityCode ?? null,
    hasArtisanCard: p?.hasArtisanCard ?? null,
    educationLevel: p?.educationLevel ?? null,
    occupation: p?.occupation ?? null,
    businessName: p?.businessName ?? null,
    economicActivity: p?.economicActivity ?? null,
    province: entity.province ?? null,
    district: entity.district ?? null,
    corregimiento: entity.corregimiento ?? null,
    address: entity.address ?? null,
    notes: entity.notes ?? null,
    email,
    phone,
  };
}

/** Normaliza input create/update a un mapa plano comparable. */
export function flattenPersonInput(input: Record<string, unknown>): Record<string, unknown> {
  const contacts = Array.isArray(input.contacts) ? input.contacts : [];
  const email =
    (contacts as Array<{ contactType?: string; contactValue?: string }>).find(
      (c) => c.contactType === 'EMAIL'
    )?.contactValue ?? null;
  const phone =
    (contacts as Array<{ contactType?: string; contactValue?: string }>).find(
      (c) => c.contactType === 'MOBILE' || c.contactType === 'PHONE'
    )?.contactValue ?? null;

  const out: Record<string, unknown> = {};
  const keys = [
    'firstName',
    'lastName',
    'secondLastName',
    'documentType',
    'documentNumber',
    'cedula',
    'gender',
    'birthDate',
    'nationalityCode',
    'hasArtisanCard',
    'educationLevel',
    'occupation',
    'businessName',
    'economicActivity',
    'province',
    'district',
    'corregimiento',
    'address',
    'notes',
  ] as const;

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      out[key === 'cedula' ? 'documentNumber' : key] = emptyToNull(
        key === 'birthDate' ? dateOnly(input[key] as string | null) : input[key]
      );
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'documentNumber') && out.documentNumber == null) {
    out.documentNumber = emptyToNull(input.documentNumber);
  }
  if (email != null || Object.prototype.hasOwnProperty.call(input, 'contacts')) {
    out.email = emptyToNull(email);
  }
  if (phone != null || Object.prototype.hasOwnProperty.call(input, 'contacts')) {
    out.phone = emptyToNull(phone);
  }

  return out;
}

/**
 * Diff solo de campos tocados en un UPDATE.
 * Si el valor anterior no existía, before[key] queda null (UI lo muestra vacío).
 */
export function buildUpdateDiff(
  current: Record<string, unknown>,
  input: Record<string, unknown>
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const flat = flattenPersonInput(input);
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  for (const [key, nextVal] of Object.entries(flat)) {
    const prevVal = emptyToNull(current[key]);
    const normalizedNext = emptyToNull(nextVal);
    if (String(prevVal ?? '') === String(normalizedNext ?? '')) continue;
    before[key] = prevVal;
    after[key] = normalizedNext;
  }

  // Si no hubo diferencias detectables, mostrar todos los campos enviados
  if (Object.keys(after).length === 0) {
    for (const [key, nextVal] of Object.entries(flat)) {
      before[key] = emptyToNull(current[key]);
      after[key] = emptyToNull(nextVal);
    }
  }

  return { before, after };
}

export function wrapChangePayload(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  apply: unknown
): ChangeDiffPayload {
  return { before, after, apply };
}

export function unwrapApplyPayload(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'apply' in payload) {
    return (payload as ChangeDiffPayload).apply;
  }
  return payload;
}
