/**
 * Caché positiva de introspección ENTRA.
 * Solo cachea active=true. TTL = ventana máxima de detección de revocación central
 * si no hay webhook (p. ej. 45s).
 */
type CacheEntry = { expiresAt: number };

const positiveCache = new Map<string, CacheEntry>();

export function getPositiveIntrospect(sessionRef: string): boolean {
  const hit = positiveCache.get(sessionRef);
  if (!hit) return false;
  if (hit.expiresAt <= Date.now()) {
    positiveCache.delete(sessionRef);
    return false;
  }
  return true;
}

export function setPositiveIntrospect(sessionRef: string, ttlMs: number): void {
  if (!sessionRef || ttlMs <= 0) return;
  positiveCache.set(sessionRef, { expiresAt: Date.now() + ttlMs });
}

export function invalidateIntrospect(sessionRef: string): void {
  positiveCache.delete(sessionRef);
}

/** Solo para tests. */
export function clearIntrospectCache(): void {
  positiveCache.clear();
}
