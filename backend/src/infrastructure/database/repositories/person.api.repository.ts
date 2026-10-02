import { Prisma } from '@prisma/client';
import { db, withAppContext } from '../client';
import { callApiProcedure, queryApi, queryApiFirst } from '../api-caller';

export type PersonSummaryRow = {
  entity_id: string;
  status: string;
  display_name: string;
  political_division_code: string | null;
  province_code: string | null;
  province_name: string | null;
  district_code: string | null;
  district_name: string | null;
  corregimiento_code: string | null;
  corregimiento_name: string | null;
  address_line: string | null;
  registro_empresarial_fecha: Date | null;
  siep_public_id: string | null;
  source_origin: string | null;
  created_at: Date;
  updated_at: Date;
  document_type: string | null;
  document_number: string | null;
  document_number_normalized: string | null;
  first_name: string;
  last_name: string;
  second_last_name: string | null;
  gender: string | null;
  birth_date: Date | null;
  nationality_code: string;
  education_level: string | null;
  occupation: string | null;
  legacy_business_name: string | null;
  has_artisan_card: boolean | null;
};

export const personApiRepository = {
  async getById(entityId: string): Promise<PersonSummaryRow | null> {
    return queryApiFirst<PersonSummaryRow>(
      db,
      Prisma.sql`SELECT * FROM api.fn_get_person(${entityId})`
    );
  },

  async search(params: {
    q?: string;
    document?: string;
    provinceCode?: string;
    limit?: number;
    offset?: number;
  }): Promise<PersonSummaryRow[]> {
    return queryApi<PersonSummaryRow>(
      db,
      Prisma.sql`SELECT * FROM api.fn_search_people(
        ${params.q ?? null}::text,
        ${params.document ?? null}::text,
        ${params.provinceCode ?? null}::text,
        ${params.limit ?? 50}::int,
        ${params.offset ?? 0}::int
      )`
    );
  },

  async create(
    actorId: string | null | undefined,
    input: {
      firstName: string;
      lastName: string;
      secondLastName?: string | null;
      documentType?: string | null;
      documentNumber?: string | null;
      gender?: string | null;
      politicalDivisionCode?: string | null;
      addressLine?: string | null;
      sourceOrigin?: string;
    },
    requestId?: string
  ): Promise<string> {
    return withAppContext(actorId ?? null, requestId, async (tx) => {
      const rows = await tx.$queryRaw<{ fn_create_person: string }[]>`
        SELECT api.fn_create_person(
          ${actorId ?? null}::text,
          ${input.firstName}::text,
          ${input.lastName}::text,
          ${input.secondLastName ?? null}::text,
          ${input.documentType ?? null}::text,
          ${input.documentNumber ?? null}::text,
          ${input.gender ?? null}::text,
          ${input.politicalDivisionCode ?? null}::text,
          ${input.addressLine ?? null}::text,
          ${input.sourceOrigin ?? 'MANUAL'}::text
        ) AS fn_create_person
      `;
      const id = rows[0]?.fn_create_person;
      if (!id) throw new Error('fn_create_person no retornó id');
      return id;
    });
  },

  async update(
    actorId: string | null | undefined,
    entityId: string,
    input: {
      firstName?: string | null;
      lastName?: string | null;
      secondLastName?: string | null;
      documentType?: string | null;
      documentNumber?: string | null;
      politicalDivisionCode?: string | null;
      addressLine?: string | null;
    },
    requestId?: string
  ): Promise<void> {
    await withAppContext(actorId ?? null, requestId, async (tx) => {
      await callApiProcedure(
        tx,
        Prisma.sql`CALL api.sp_update_person(
          ${actorId ?? null}::text,
          ${entityId}::text,
          ${input.firstName ?? null}::text,
          ${input.lastName ?? null}::text,
          ${input.secondLastName ?? null}::text,
          ${input.documentType ?? null}::text,
          ${input.documentNumber ?? null}::text,
          ${input.politicalDivisionCode ?? null}::text,
          ${input.addressLine ?? null}::text
        )`
      );
    });
  },

  async softDelete(actorId: string | null | undefined, entityId: string, reason?: string, requestId?: string): Promise<void> {
    await withAppContext(actorId ?? null, requestId, async (tx) => {
      await callApiProcedure(
        tx,
        Prisma.sql`CALL api.sp_soft_delete_person(
          ${actorId ?? null}::text,
          ${entityId}::text,
          ${reason ?? null}::text
        )`
      );
    });
  },

  async restore(actorId: string | null | undefined, entityId: string, requestId?: string): Promise<void> {
    await withAppContext(actorId ?? null, requestId, async (tx) => {
      await callApiProcedure(
        tx,
        Prisma.sql`CALL api.sp_restore_person(${actorId ?? null}::text, ${entityId}::text)`
      );
    });
  },
};
