import { Prisma } from '@prisma/client';
import { db, withAppContext } from '../client';
import { callApiProcedure, queryApi } from '../api-caller';

export type ContactRow = {
  id: string;
  entity_id: string;
  contact_type: string;
  contact_value: string;
  normalized_value: string | null;
  label: string | null;
  is_primary: boolean;
  is_verified: boolean;
};

export const contactApiRepository = {
  async listByEntity(entityId: string): Promise<ContactRow[]> {
    return queryApi<ContactRow>(
      db,
      Prisma.sql`SELECT * FROM api.v_entity_contacts WHERE entity_id = ${entityId}`
    );
  },

  async add(
    actorId: string | null | undefined,
    input: {
      entityId: string;
      contactType: string;
      contactValue: string;
      label?: string | null;
      isPrimary?: boolean;
    },
    requestId?: string
  ): Promise<string> {
    return withAppContext(actorId ?? null, requestId, async (tx) => {
      const rows = await tx.$queryRaw<{ fn_add_contact: string }[]>`
        SELECT api.fn_add_contact(
          ${actorId ?? null}::text,
          ${input.entityId}::text,
          ${input.contactType}::text,
          ${input.contactValue}::text,
          ${input.label ?? null}::text,
          ${input.isPrimary ?? false}::boolean
        ) AS fn_add_contact
      `;
      const id = rows[0]?.fn_add_contact;
      if (!id) throw new Error('fn_add_contact no retornó id');
      return id;
    });
  },

  async softDelete(actorId: string | null | undefined, contactId: string, requestId?: string): Promise<void> {
    await withAppContext(actorId ?? null, requestId, async (tx) => {
      await callApiProcedure(
        tx,
        Prisma.sql`CALL api.sp_soft_delete_contact(${actorId ?? null}::text, ${contactId}::text)`
      );
    });
  },
};
