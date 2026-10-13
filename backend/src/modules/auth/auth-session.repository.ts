/**
 * Persistencia de sesiones CRM vía api.fn_* / api.sp_* (sin DML directo).
 */
import { prisma } from '../../config/database';

export type CrmSessionRow = {
  id: string;
  user_id: string;
  family_id: string;
  refresh_token_hash: string;
  absolute_expires_at: Date;
  revoked_at: Date | null;
  revoke_reason: string | null;
  created_at: Date;
  entra_session_ref: string | null;
};

export type RotateOutcome =
  | 'rotated'
  | 'reuse_detected'
  | 'not_found'
  | 'revoked'
  | 'expired'
  | 'hash_mismatch';

export const authSessionRepository = {
  async create(input: {
    id: string;
    userId: string;
    familyId: string;
    refreshTokenHash: string;
    absoluteExpiresAt: Date;
    entraSessionRef?: string | null;
  }): Promise<CrmSessionRow> {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        user_id: string;
        family_id: string;
        absolute_expires_at: Date;
        revoked_at: Date | null;
        entra_session_ref: string | null;
      }>
    >`
      SELECT * FROM api.fn_create_crm_session(
        ${input.id}::text,
        ${input.userId}::text,
        ${input.familyId}::text,
        ${input.refreshTokenHash}::text,
        ${input.absoluteExpiresAt}::timestamptz,
        ${input.entraSessionRef ?? null}::text
      )
    `;
    const row = rows[0];
    if (!row) throw new Error('No se pudo crear la sesión CRM');
    return {
      id: row.id,
      user_id: row.user_id,
      family_id: row.family_id,
      refresh_token_hash: input.refreshTokenHash,
      absolute_expires_at: row.absolute_expires_at,
      revoked_at: row.revoked_at,
      revoke_reason: null,
      created_at: new Date(),
      entra_session_ref: row.entra_session_ref,
    };
  },

  async findById(id: string): Promise<CrmSessionRow | null> {
    const rows = await prisma.$queryRaw<CrmSessionRow[]>`
      SELECT * FROM api.fn_get_crm_session(${id}::text)
    `;
    return rows[0] ?? null;
  },

  async rotateRefresh(
    sid: string,
    presentedHash: string,
    newHash: string
  ): Promise<{
    outcome: RotateOutcome;
    userId: string | null;
    familyId: string | null;
    absoluteExpiresAt: Date | null;
  }> {
    const rows = await prisma.$queryRaw<
      Array<{
        outcome: string;
        user_id: string | null;
        family_id: string | null;
        absolute_expires_at: Date | null;
      }>
    >`
      SELECT * FROM api.fn_rotate_crm_refresh(
        ${sid}::text,
        ${presentedHash}::text,
        ${newHash}::text
      )
    `;
    const row = rows[0];
    return {
      outcome: (row?.outcome ?? 'not_found') as RotateOutcome,
      userId: row?.user_id ?? null,
      familyId: row?.family_id ?? null,
      absoluteExpiresAt: row?.absolute_expires_at ?? null,
    };
  },

  async revoke(sid: string, reason: string = 'logout'): Promise<void> {
    await prisma.$executeRaw`
      CALL api.sp_revoke_crm_session(${sid}::text, ${reason}::text)
    `;
  },

  async revokeFamily(familyId: string, reason: string = 'family_revoke'): Promise<void> {
    await prisma.$executeRaw`
      CALL api.sp_revoke_crm_session_family(${familyId}::text, ${reason}::text)
    `;
  },

  async revokeAllForUser(userId: string, reason: string = 'user_disabled'): Promise<void> {
    await prisma.$executeRaw`
      CALL api.sp_revoke_crm_sessions_for_user(${userId}::text, ${reason}::text)
    `;
  },

  async revokeByEntraSessionRef(
    entraSessionRef: string,
    reason: string = 'entra_revoked'
  ): Promise<string[]> {
    const rows = await prisma.$queryRaw<Array<{ sid: string }>>`
      SELECT * FROM api.fn_revoke_crm_sessions_by_entra_ref(
        ${entraSessionRef}::text,
        ${reason}::text
      )
    `;
    return rows.map((r) => r.sid);
  },

  isActive(session: CrmSessionRow, now: Date = new Date()): boolean {
    if (session.revoked_at) return false;
    if (session.absolute_expires_at.getTime() <= now.getTime()) return false;
    return true;
  },
};
