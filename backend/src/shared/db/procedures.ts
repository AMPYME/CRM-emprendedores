/**
 * Invoca procedimientos legacy public.sp_* de forma parametrizada.
 * Prohibido $executeRawUnsafe.
 */
import { Prisma } from '@prisma/client';

type ProcedureRunner = {
  $executeRaw: (query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]) => Promise<unknown>;
};

export type ProcArg = {
  value: string | null;
  cast: 'text';
};

/** @deprecated Preferir infrastructure/database */
export async function callProcedure(
  db: ProcedureRunner,
  name: string,
  args: ProcArg[]
): Promise<void> {
  const a0 = args[0]?.value ?? null;
  const a1 = args[1]?.value ?? null;

  switch (name) {
    case 'sp_db_ping':
      await db.$executeRaw`CALL public.sp_db_ping()`;
      return;
    case 'sp_soft_delete_contact':
      await db.$executeRaw`CALL public.sp_soft_delete_contact(${a0}::text, ${a1}::text)`;
      return;
    case 'sp_soft_delete_registration':
      await db.$executeRaw`CALL public.sp_soft_delete_registration(${a0}::text, ${a1}::text)`;
      return;
    case 'sp_soft_delete_intake_sessions':
      await db.$executeRaw`CALL public.sp_soft_delete_intake_sessions(${a0}::text, ${a1}::text)`;
      return;
    case 'sp_soft_delete_verifications_unvalidated':
      await db.$executeRaw`CALL public.sp_soft_delete_verifications_unvalidated(${a0}::text, ${a1}::text)`;
      return;
    default:
      throw new Error(`Procedimiento no permitido: ${name}`);
  }
}
