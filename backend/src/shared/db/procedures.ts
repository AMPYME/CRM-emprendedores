/**
 * Invoca procedimientos almacenados. El DML vive en PostgreSQL, no en la aplicación.
 */
type ProcedureRunner = {
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<number>;
};

export type ProcArg = {
  value: string | null;
  cast: 'text';
};

export async function callProcedure(
  db: ProcedureRunner,
  name: string,
  args: ProcArg[]
): Promise<void> {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error('Procedimiento no permitido');
  }
  const binds = args.map((arg, index) => `$${index + 1}::${arg.cast}`).join(', ');
  await db.$executeRawUnsafe(`CALL public.${name}(${binds})`, ...args.map((arg) => arg.value));
}
