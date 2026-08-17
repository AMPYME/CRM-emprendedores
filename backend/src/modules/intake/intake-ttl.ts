/**
 * TTL de inactividad de sesiones de intake.
 */
import { config } from '../../config/environment';

export function ttlExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + config.intakeSessionTtlMin * 60 * 1000);
}
