import { Prisma } from '@prisma/client';
import { db, withAppContext } from '../client';
import { callApiProcedure, queryApi, queryApiFirst } from '../api-caller';

export const portfolioApiRepository = {
  async listSummary(limit = 50, offset = 0) {
    return queryApi(
      db,
      Prisma.sql`
        SELECT * FROM api.v_portfolio_summary
        ORDER BY created_at DESC
        LIMIT ${Math.min(limit, 100)} OFFSET ${Math.max(offset, 0)}
      `
    );
  },

  async create(
    actorId: string,
    input: {
      entityId: string;
      subject: string;
      description?: string | null;
      priority?: string;
      category?: string | null;
      assignedToId?: string | null;
      sedeId?: string | null;
      departamentoId?: string | null;
    },
    requestId?: string
  ): Promise<string> {
    return withAppContext(actorId, requestId, async (tx) => {
      await callApiProcedure(
        tx,
        Prisma.sql`CALL api.sp_create_portfolio(
          ${actorId}::text,
          ${input.entityId}::text,
          ${input.subject}::text,
          ${input.description ?? null}::text,
          ${input.priority ?? 'MEDIUM'}::text,
          ${input.category ?? null}::text,
          ${input.assignedToId ?? null}::text,
          ${input.sedeId ?? null}::text,
          ${input.departamentoId ?? null}::text,
          NULL::text
        )`
      );
      const row = await queryApiFirst<{ id: string }>(
        tx,
        Prisma.sql`
          SELECT id FROM api.v_portfolio_summary
          WHERE entity_id = ${input.entityId} AND subject = ${input.subject}
          ORDER BY created_at DESC LIMIT 1
        `
      );
      if (!row?.id) throw new Error('sp_create_portfolio no retornó id');
      return row.id;
    });
  },

  async changeStatus(
    actorId: string,
    portfolioId: string,
    newStatus: string,
    reason?: string,
    requestId?: string
  ): Promise<void> {
    await withAppContext(actorId, requestId, async (tx) => {
      await callApiProcedure(
        tx,
        Prisma.sql`CALL api.sp_change_portfolio_status(
          ${actorId}::text,
          ${portfolioId}::text,
          ${newStatus}::text,
          ${reason ?? null}::text
        )`
      );
    });
  },
};

export const verificationApiRepository = {
  async queue(limit = 50, offset = 0) {
    return queryApi(
      db,
      Prisma.sql`SELECT * FROM api.fn_get_verification_queue(${limit}::int, ${offset}::int)`
    );
  },

  async claimNext(actorId: string, requestId?: string): Promise<string | null> {
    return withAppContext(actorId, requestId, async (tx) => {
      await callApiProcedure(
        tx,
        Prisma.sql`CALL api.sp_assign_verification(${actorId}::text, NULL::text)`
      );
      const row = await queryApiFirst<{ id: string }>(
        tx,
        Prisma.sql`
          SELECT id FROM api.v_verification_queue
          WHERE assigned_to_id = ${actorId}
          ORDER BY assigned_at DESC NULLS LAST
          LIMIT 1
        `
      );
      return row?.id ?? null;
    });
  },

  async reject(actorId: string, itemId: string, reason: string, requestId?: string): Promise<void> {
    await withAppContext(actorId, requestId, async (tx) => {
      await callApiProcedure(
        tx,
        Prisma.sql`CALL api.sp_reject_verification(
          ${actorId}::text, ${itemId}::text, ${reason}::text
        )`
      );
    });
  },
};

export const importApiRepository = {
  async getProgress(batchId: string) {
    return queryApiFirst(
      db,
      Prisma.sql`SELECT * FROM api.fn_get_import_progress(${batchId})`
    );
  },

  async updateProgress(
    batchId: string,
    stage: string,
    percent: number,
    message?: string,
    processedRows?: number
  ): Promise<void> {
    await callApiProcedure(
      db,
      Prisma.sql`CALL api.sp_update_import_progress(
        ${batchId}::text,
        ${stage}::text,
        ${percent}::int,
        ${message ?? null}::text,
        ${processedRows ?? null}::int
      )`
    );
  },
};

export const capitalApiRepository = {
  async link(
    actorId: string,
    capitalId: string,
    personEntityId: string,
    linkedAt?: string | null,
    requestId?: string
  ): Promise<void> {
    await withAppContext(actorId, requestId, async (tx) => {
      await callApiProcedure(
        tx,
        Prisma.sql`CALL api.sp_link_capital_semilla(
          ${actorId}::text,
          ${capitalId}::text,
          ${personEntityId}::text,
          COALESCE(${linkedAt}::date, CURRENT_DATE)
        )`
      );
    });
  },
};

export const relationshipApiRepository = {
  async create(
    actorId: string,
    input: {
      fromEntityId: string;
      toEntityId: string;
      relationshipType: string;
      role?: string | null;
    },
    requestId?: string
  ): Promise<string> {
    return withAppContext(actorId, requestId, async (tx) => {
      await callApiProcedure(
        tx,
        Prisma.sql`CALL api.sp_create_relationship(
          ${actorId}::text,
          ${input.fromEntityId}::text,
          ${input.toEntityId}::text,
          ${input.relationshipType}::text,
          ${input.role ?? null}::text,
          NULL::text
        )`
      );
      const row = await queryApiFirst<{ id: string }>(
        tx,
        Prisma.sql`
          SELECT id FROM api.v_entity_relationships
          WHERE from_entity_id = ${input.fromEntityId}
            AND to_entity_id = ${input.toEntityId}
            AND relationship_type::text = ${input.relationshipType}
          ORDER BY created_at DESC LIMIT 1
        `
      );
      if (!row?.id) throw new Error('sp_create_relationship no retornó id');
      return row.id;
    });
  },

  async end(actorId: string, relationshipId: string, requestId?: string): Promise<void> {
    await withAppContext(actorId, requestId, async (tx) => {
      await callApiProcedure(
        tx,
        Prisma.sql`CALL api.sp_end_relationship(${actorId}::text, ${relationshipId}::text)`
      );
    });
  },
};

export const changeRequestApiRepository = {
  async cancel(actorId: string, requestId: string, httpRequestId?: string): Promise<void> {
    await withAppContext(actorId, httpRequestId, async (tx) => {
      await callApiProcedure(
        tx,
        Prisma.sql`CALL api.sp_cancel_change_request(${actorId}::text, ${requestId}::text)`
      );
    });
  },
};

export const entityMergeApiRepository = {
  async merge(actorId: string, sourceId: string, targetId: string, requestId?: string): Promise<void> {
    await withAppContext(actorId, requestId, async (tx) => {
      await callApiProcedure(
        tx,
        Prisma.sql`CALL api.sp_merge_entities(
          ${actorId}::text, ${sourceId}::text, ${targetId}::text
        )`
      );
    });
  },
};

export const registroEmpresarialApiRepository = {
  async setFecha(actorId: string, entityId: string, fecha: string | null, requestId?: string): Promise<void> {
    await withAppContext(actorId, requestId, async (tx) => {
      await callApiProcedure(
        tx,
        Prisma.sql`CALL api.sp_set_registro_empresarial(
          ${actorId}::text,
          ${entityId}::text,
          ${fecha}::date
        )`
      );
    });
  },
};
