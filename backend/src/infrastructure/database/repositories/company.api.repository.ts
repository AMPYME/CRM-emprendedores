import { Prisma } from '@prisma/client';
import { db, withAppContext } from '../client';
import { callApiProcedure, queryApiFirst } from '../api-caller';

export type CompanySummaryRow = {
  entity_id: string;
  status: string;
  display_name: string;
  political_division_code: string | null;
  ruc: string | null;
  dv: string | null;
  ruc_normalized: string | null;
  legal_name: string;
  trade_name: string | null;
  company_type: string | null;
  company_size_class: string | null;
  founded_date: Date | null;
  employee_count: number | null;
  address_line: string | null;
  created_at: Date;
};

export const companyApiRepository = {
  async getById(entityId: string): Promise<CompanySummaryRow | null> {
    return queryApiFirst<CompanySummaryRow>(
      db,
      Prisma.sql`SELECT * FROM api.fn_get_company(${entityId})`
    );
  },

  async create(
    actorId: string | null | undefined,
    input: {
      legalName: string;
      tradeName?: string | null;
      ruc?: string | null;
      dv?: string | null;
      politicalDivisionCode?: string | null;
      addressLine?: string | null;
      sourceOrigin?: string;
    },
    requestId?: string
  ): Promise<string> {
    return withAppContext(actorId ?? null, requestId, async (tx) => {
      const rows = await tx.$queryRaw<{ fn_create_company: string }[]>`
        SELECT api.fn_create_company(
          ${actorId ?? null}::text,
          ${input.legalName}::text,
          ${input.tradeName ?? null}::text,
          ${input.ruc ?? null}::text,
          ${input.dv ?? null}::text,
          ${input.politicalDivisionCode ?? null}::text,
          ${input.addressLine ?? null}::text,
          ${input.sourceOrigin ?? 'MANUAL'}::text
        ) AS fn_create_company
      `;
      const id = rows[0]?.fn_create_company;
      if (!id) throw new Error('fn_create_company no retornó id');
      return id;
    });
  },

  async softDelete(actorId: string | null | undefined, entityId: string, reason?: string, requestId?: string): Promise<void> {
    await withAppContext(actorId ?? null, requestId, async (tx) => {
      await callApiProcedure(
        tx,
        Prisma.sql`CALL api.sp_soft_delete_company(
          ${actorId ?? null}::text,
          ${entityId}::text,
          ${reason ?? null}::text
        )`
      );
    });
  },
};
