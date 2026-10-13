/**
 * Pruebas unitarias locales (sin ENTRA real).
 * Casos que dependen de introspección central: ver docs/AUTH_ENTRA_GAP.md.
 */
import { createHash } from 'crypto';
import { authSessionCrypto } from '../auth.service';

describe('authSessionCrypto', () => {
  it('hashToken es SHA-256 hex estable', () => {
    const token = 'refresh-sample';
    expect(authSessionCrypto.hashToken(token)).toBe(
      createHash('sha256').update(token).digest('hex')
    );
  });

  it('parseDurationToMs interpreta unidades comunes', () => {
    expect(authSessionCrypto.parseDurationToMs('15m')).toBe(15 * 60 * 1000);
    expect(authSessionCrypto.parseDurationToMs('8h')).toBe(8 * 60 * 60 * 1000);
    expect(authSessionCrypto.parseDurationToMs('1d')).toBe(24 * 60 * 60 * 1000);
  });
});

describe('política de roles ENTRA (documentada)', () => {
  const { mapAdRolesToCrmRole } = require('../ad-auth.mapper') as typeof import('../ad-auth.mapper');

  it('ENTRA OPERATOR no conserva privilegio: mapea a EMPREND_OPERADOR', () => {
    expect(mapAdRolesToCrmRole(['EMPREND_OPERADOR'])).toBe('EMPREND_OPERADOR');
  });

  it('VIEWER degrada explícitamente', () => {
    expect(mapAdRolesToCrmRole(['EMPREND_VIEWER'])).toBe('EMPREND_VIEWER');
  });

  it('ADMIN de Entra mapea a ADMIN', () => {
    expect(mapAdRolesToCrmRole(['ADMIN'])).toBe('ADMIN');
  });
});
