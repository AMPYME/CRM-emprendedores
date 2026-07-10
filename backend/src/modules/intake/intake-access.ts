/**
 * Código de acceso de 6 dígitos para sesiones de intake (hash SHA-256).
 */
import crypto from 'crypto';

/** Genera un código numérico de 6 dígitos (con ceros a la izquierda). */
export function generateAccessCode(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, '0');
}

/** Hash SHA-256 en hexadecimal. */
export function hashAccessCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim()).digest('hex');
}

/** Compara un código en texto plano con el hash almacenado. */
export function verifyAccessCode(code: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !code.trim()) return false;
  return hashAccessCode(code) === storedHash;
}
