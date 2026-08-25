/**
 * TTL de inactividad de sesiones de intake.
 *
 * Hay dos relojes distintos:
 *
 * 1. Captura en campo / enlace QR (source FIELD o sesión sin verificación)
 *    - `INTAKE_SESSION_TTL_MIN` (por defecto 20 minutos).
 *    - Si expira, la sesión se borra. El ítem FIELD queda asignado al
 *      funcionario que lo abrió (no se libera a la cola).
 *
 * 2. Verificación de importación (source IMPORT, no FIELD)
 *    - 30 minutos desde el último **cambio de datos** del snapshot.
 *    - El heartbeat / ping del WebSocket NO renueva este plazo: hace falta
 *      guardar o editar el registro. Así un funcionario no deja el ítem
 *      bloqueado con la pantalla abierta y sin trabajar.
 *    - Si expira: se borra la sesión intake, se desasigna el ítem y vuelve
 *      a PENDING para que otro funcionario pueda tomarlo.
 *
 * La cola en /dashboard/intake se actualiza por WebSocket (`subscribe_queue`);
 * la sesión abierta de un ítem usa el mismo WS (`subscribe` + snapshot).
 */
import { config } from '../../config/environment';
import { prisma } from '../../config/database';

/** Minutos de inactividad para ítems de verificación originados en importación. */
export const IMPORT_VERIFICATION_INACTIVITY_TTL_MIN = 30;

export function fieldIntakeTtlMinutes(): number {
  return config.intakeSessionTtlMin;
}

export function ttlMinutesForVerificationSource(
  source: 'IMPORT' | 'FIELD' | string | null | undefined
): number {
  if (source === 'IMPORT') return IMPORT_VERIFICATION_INACTIVITY_TTL_MIN;
  return fieldIntakeTtlMinutes();
}

export function ttlExpiresAt(from = new Date(), ttlMinutes = fieldIntakeTtlMinutes()): Date {
  return new Date(from.getTime() + ttlMinutes * 60 * 1000);
}

/** Resuelve el TTL según si la sesión está ligada a un ítem IMPORT o FIELD. */
export async function ttlExpiresAtForSession(
  sessionId: string,
  from = new Date()
): Promise<Date> {
  const item = await prisma.verificationItem.findUnique({
    where: { intakeSessionId: sessionId },
    select: { source: true },
  });
  return ttlExpiresAt(from, ttlMinutesForVerificationSource(item?.source));
}
