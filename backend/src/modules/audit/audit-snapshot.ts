import { prisma } from '../../config/database';
import type { AuditActor } from './audit.service';

function usuarioDe(username: string | null | undefined): string | null {
  const raw = username?.trim() || '';
  if (!raw || raw.includes('@')) return null;
  return raw;
}

export async function actorContext(actor?: AuditActor) {
  if (!actor?.userId) {
    return {
      usuario: null,
      sede: null as string | null,
      departamento: null as string | null,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: {
      username: true,
      sede: { select: { name: true } },
      departamento: { select: { name: true } },
    },
  });

  return {
    usuario: usuarioDe(user?.username),
    sede: user?.sede?.name ?? null,
    departamento: user?.departamento?.name ?? null,
  };
}

function normalizar(value: unknown): string {
  if (value == null || value === '') return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  return String(value);
}

function presentable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value ?? null;
}

export function cambios(
  antes: Record<string, unknown>,
  input: Record<string, unknown>,
): { anterior: Record<string, unknown>; nuevo: Record<string, unknown> } {
  const anterior: Record<string, unknown> = {};
  const nuevo: Record<string, unknown> = {};

  for (const key of Object.keys(input)) {
    if (input[key] === undefined) continue;
    const previo = antes[key] ?? null;
    const siguiente = input[key] ?? null;
    if (normalizar(previo) === normalizar(siguiente)) continue;
    anterior[key] = presentable(previo);
    nuevo[key] = presentable(siguiente);
  }

  return { anterior, nuevo };
}
