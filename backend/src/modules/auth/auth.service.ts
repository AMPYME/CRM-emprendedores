/**
 * Autenticación CRM: JWT con sid local + sessionRef ENTRA (introspección S2S).
 * Ventana residual = ENTRA_INTROSPECT_CACHE_TTL_MS si hay caché positiva;
 * ~0 con webhook de revocación. Ver docs/AUTH_ENTRA_GAP.md.
 */
import { createHash, randomUUID } from 'crypto';
import jwt, { type JwtPayload as LibJwtPayload, SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../../config/environment';
import { authRepository, SafeUser } from './auth.repository';
import { authSessionRepository, type CrmSessionRow } from './auth-session.repository';
import { exchangeEntraCode, introspectEntraSession } from './entra-user-api.client';
import {
  getPositiveIntrospect,
  invalidateIntrospect,
  setPositiveIntrospect,
} from './entra-introspect-cache';
import {
  resolveEmailForLocalUser,
  resolveUsername,
  namesFromDirectoryProfile,
  hasAnyRequiredAdRole,
  mapAdRolesToCrmRole,
} from './ad-auth.mapper';
import { UserRole } from '@prisma/client';
import {
  ExchangeInput,
  RegisterInput,
  RefreshInput,
  ChangePasswordInput,
  UpdateProfileInput,
} from './auth.validator';
import {
  AuthUser,
  AuthTokenResponse,
  JwtPayload,
  JwtRefreshPayload,
} from './auth.types';
import {
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  ServiceUnavailableError,
} from '../../shared/errors/app-error';
import { logger } from '../../shared/logger/logger';
import { auditService } from '../audit/audit.service';

const SALT_ROUNDS = 12;

type SessionNotify = (sid: string) => void;
let onSessionRevoked: SessionNotify | null = null;

/** Permite que el servidor WS cierre conexiones al revocar. */
export function registerSessionRevokedHandler(handler: SessionNotify): void {
  onSessionRevoked = handler;
}

function notifyRevoked(sid: string): void {
  try {
    onSessionRevoked?.(sid);
  } catch {
    /* no bloquear auth */
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function parseDurationToMs(value: string): number {
  const m = /^(\d+)(ms|s|m|h|d)$/i.exec(value.trim());
  if (!m) return 8 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  switch (m[2].toLowerCase()) {
    case 'ms':
      return n;
    case 's':
      return n * 1000;
    case 'm':
      return n * 60 * 1000;
    case 'h':
      return n * 60 * 60 * 1000;
    case 'd':
      return n * 24 * 60 * 60 * 1000;
    default:
      return 8 * 60 * 60 * 1000;
  }
}

function secondsUntil(date: Date): number {
  return Math.max(1, Math.floor((date.getTime() - Date.now()) / 1000));
}

async function logLogin(user: SafeUser): Promise<void> {
  try {
    await auditService.log({
      action: 'LOGIN',
      entityType: 'USER',
      entityId: user.id,
      entityLabel: user.email,
      userId: user.id,
      userEmail: user.email,
    });
  } catch (error) {
    logger.warn('No se pudo registrar LOGIN en auditoría', {
      userId: user.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function verifySignedToken<T extends object>(token: string): T {
  try {
    const decoded = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
    });
    if (!decoded || typeof decoded === 'string') {
      throw new UnauthorizedError('Token inválido');
    }
    return decoded as T;
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token expirado');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Token inválido');
    }
    throw new UnauthorizedError('Error al verificar token');
  }
}

function generateAccessToken(user: SafeUser, sid: string): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    type: 'access',
    sid,
  };
  const options: SignOptions = {
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
    algorithm: 'HS256',
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  };
  return jwt.sign(payload, config.jwtSecret, options);
}

function generateRefreshToken(
  user: SafeUser,
  sid: string,
  familyId: string,
  absoluteExpiresAt: Date
): string {
  const payload: JwtRefreshPayload = {
    sub: user.id,
    type: 'refresh',
    sid,
    fid: familyId,
  };
  const options: SignOptions = {
    expiresIn: secondsUntil(absoluteExpiresAt),
    algorithm: 'HS256',
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  };
  return jwt.sign(payload, config.jwtSecret, options);
}

function toAuthUser(user: SafeUser): AuthUser {
  const sede =
    user.sede && !user.sede.deletedAt
      ? { id: user.sede.id, name: user.sede.name }
      : null;
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    sede,
  };
}

/**
 * Rol efectivo: ENTRA gobierna en cada exchange (sin conservar admin local
 * si ENTRA mapea a operador u otro rol inferior).
 */
function resolveAdRoleSync(adRoles: string[], _currentRole: UserRole): UserRole {
  if (!config.entraGovernsRoles) {
    return mapAdRolesToCrmRole(adRoles) as UserRole;
  }
  return mapAdRolesToCrmRole(adRoles) as UserRole;
}

async function assertCentralSessionActive(session: CrmSessionRow): Promise<void> {
  if (!config.entraRequireIntrospect) return;
  const sessionRef = session.entra_session_ref;
  if (!sessionRef) {
    // Sesiones antiguas sin vínculo: no se puede confirmar ENTRA.
    throw new UnauthorizedError('Sesión sin vínculo central; vuelva a iniciar sesión');
  }
  if (getPositiveIntrospect(sessionRef)) return;

  if (!config.entraApiBaseUrl || !config.entraClientId || !config.entraClientSecret) {
    throw new ServiceUnavailableError('Introspección central no configurada');
  }

  const outcome = await introspectEntraSession(
    config.entraApiBaseUrl,
    sessionRef,
    config.entraClientId,
    config.entraClientSecret
  );

  if (outcome.kind === 'active') {
    setPositiveIntrospect(sessionRef, config.entraIntrospectCacheTtlMs);
    return;
  }
  if (outcome.kind === 'inactive' || outcome.kind === 'unauthorized') {
    invalidateIntrospect(sessionRef);
    await authSessionRepository.revoke(session.id, 'entra_inactive');
    notifyRevoked(session.id);
    throw new UnauthorizedError('Sesión central expirada o revocada');
  }
  // unavailable → fail-closed
  throw new ServiceUnavailableError(
    'No se pudo verificar la sesión central. Intente más tarde.'
  );
}

async function issueSessionTokens(
  user: SafeUser,
  opts?: { entraSessionRef?: string; entraAbsoluteExpiresAt?: string }
): Promise<AuthTokenResponse> {
  const sid = randomUUID();
  const familyId = randomUUID();
  let absoluteExpiresAt = new Date(Date.now() + parseDurationToMs(config.sessionAbsoluteTtl));
  if (opts?.entraAbsoluteExpiresAt) {
    const entraAbs = new Date(opts.entraAbsoluteExpiresAt);
    if (!Number.isNaN(entraAbs.getTime()) && entraAbs.getTime() < absoluteExpiresAt.getTime()) {
      absoluteExpiresAt = entraAbs;
    }
  }
  const refreshToken = generateRefreshToken(user, sid, familyId, absoluteExpiresAt);
  const accessToken = generateAccessToken(user, sid);

  await authSessionRepository.create({
    id: sid,
    userId: user.id,
    familyId,
    refreshTokenHash: hashToken(refreshToken),
    absoluteExpiresAt,
    entraSessionRef: opts?.entraSessionRef ?? null,
  });

  if (opts?.entraSessionRef) {
    setPositiveIntrospect(opts.entraSessionRef, config.entraIntrospectCacheTtlMs);
  }

  return {
    user: toAuthUser(user),
    accessToken,
    refreshToken,
    sessionId: sid,
    absoluteExpiresAt: absoluteExpiresAt.toISOString(),
  };
}

export const authService = {
  async exchange(input: ExchangeInput): Promise<AuthTokenResponse> {
    if (!config.entraApiBaseUrl || !config.entraClientId || !config.entraClientSecret) {
      throw new UnauthorizedError(
        'Autenticación no disponible: configure ENTRA_API_BASE_URL, EMPRENDEDORES_CLIENT_ID y EMPRENDEDORES_APP_SECRET.'
      );
    }

    const outcome = await exchangeEntraCode(
      config.entraApiBaseUrl,
      input.code,
      config.entraClientId,
      config.entraClientSecret
    );

    if (outcome.kind === 'invalid_code') {
      throw new UnauthorizedError('El código de ingreso es inválido o ya venció. Vuelva a entrar.');
    }

    if (outcome.kind === 'unavailable') {
      throw new UnauthorizedError(
        'No se pudo contactar el servicio de identidad. Intente más tarde.'
      );
    }

    const profile = outcome.profile;
    const directoryRoles = profile.roles ?? [];
    if (
      !config.entraSkipRoleCheck &&
      !hasAnyRequiredAdRole(directoryRoles, config.entraRequiredAppRoleSlugs)
    ) {
      throw new ForbiddenError(
        'No tiene acceso a este sistema. Se requiere un rol de Entra habilitado para Emprendedores.'
      );
    }

    const emailResolved = resolveEmailForLocalUser(profile);
    if (!emailResolved) {
      throw new UnauthorizedError('El perfil de Entra no trae un correo válido.');
    }

    const directoryUsername = resolveUsername(profile);
    let user = await authRepository.findByEmail(emailResolved);

    if (!user) {
      if (!config.entraAutoProvision) {
        throw new ForbiddenError(
          'Usuario no registrado en el CRM. Solicite acceso al administrador.'
        );
      }
      const { firstName, lastName } = namesFromDirectoryProfile(profile);
      const placeholderHash = await bcrypt.hash(randomUUID(), SALT_ROUNDS);
      const crmRole = mapAdRolesToCrmRole(directoryRoles);
      const created = await authRepository.create({
        email: emailResolved,
        passwordHash: placeholderHash,
        firstName,
        lastName,
        username: directoryUsername,
        role: crmRole,
      });
      const safe = await authRepository.updateLastLogin(created.id, undefined, directoryUsername);
      logger.info('Login exitoso (Entra + alta automática)', {
        userId: safe.id,
        email: safe.email,
      });
      await logLogin(safe);
      return issueSessionTokens(safe, {
        entraSessionRef: profile.sessionRef,
        entraAbsoluteExpiresAt: profile.sessionAbsoluteExpiresAt,
      });
    }

    if (!user.isActive) {
      throw new ForbiddenError('Cuenta desactivada. Contacte al administrador');
    }

    const roleSync = resolveAdRoleSync(directoryRoles, user.role);
    const safeUser = await authRepository.updateLastLogin(user.id, roleSync, directoryUsername);
    logger.info('Login exitoso (Entra)', { userId: user.id, email: user.email });
    await logLogin(safeUser);
    return issueSessionTokens(safeUser, {
      entraSessionRef: profile.sessionRef,
      entraAbsoluteExpiresAt: profile.sessionAbsoluteExpiresAt,
    });
  },

  async register(_input: RegisterInput): Promise<AuthTokenResponse> {
    throw new ForbiddenError(
      'El registro local está deshabilitado. Use el inicio de sesión con Microsoft Entra ID.'
    );
  },

  /**
   * Renueva access+refresh con rotación atómica.
   * No desplaza absoluteExpiresAt. Exige sesión central activa (introspect).
   */
  async refresh(input: RefreshInput): Promise<AuthTokenResponse> {
    const decoded = verifySignedToken<JwtRefreshPayload & LibJwtPayload>(input.refreshToken);

    if (decoded.type !== 'refresh' || !decoded.sid || !decoded.fid) {
      throw new UnauthorizedError('Tipo de token inválido');
    }

    const presentedHash = hashToken(input.refreshToken);
    const newSid = decoded.sid;

    const session = await authSessionRepository.findById(decoded.sid);
    if (!session) {
      throw new UnauthorizedError('Sesión no encontrada');
    }

    if (session.user_id !== decoded.sub || session.family_id !== decoded.fid) {
      await authSessionRepository.revokeFamily(decoded.fid, 'token_mismatch');
      notifyRevoked(decoded.sid);
      throw new UnauthorizedError('Sesión inválida');
    }

    if (!authSessionRepository.isActive(session)) {
      if (!session.revoked_at) {
        await authSessionRepository.revoke(decoded.sid, 'absolute_expired');
      }
      notifyRevoked(decoded.sid);
      throw new UnauthorizedError('Sesión expirada o revocada');
    }

    await assertCentralSessionActive(session);

    const user = await authRepository.findByIdSafe(decoded.sub);
    if (!user) {
      throw new UnauthorizedError('Usuario no encontrado');
    }
    if (!user.isActive) {
      await authSessionRepository.revokeAllForUser(user.id, 'user_disabled');
      notifyRevoked(decoded.sid);
      throw new ForbiddenError('Cuenta desactivada');
    }

    const absoluteExpiresAt = session.absolute_expires_at;
    const newRefresh = generateRefreshToken(user, newSid, decoded.fid, absoluteExpiresAt);
    const newHash = hashToken(newRefresh);

    const rotation = await authSessionRepository.rotateRefresh(decoded.sid, presentedHash, newHash);

    if (rotation.outcome === 'reuse_detected') {
      notifyRevoked(decoded.sid);
      throw new UnauthorizedError('Refresh reutilizado: sesión revocada');
    }
    if (rotation.outcome === 'revoked' || rotation.outcome === 'expired') {
      notifyRevoked(decoded.sid);
      throw new UnauthorizedError('Sesión expirada o revocada');
    }
    if (rotation.outcome !== 'rotated') {
      throw new UnauthorizedError('No se pudo renovar la sesión');
    }

    const accessToken = generateAccessToken(user, decoded.sid);
    logger.debug('Token renovado', { userId: user.id, sid: decoded.sid });

    return {
      user: toAuthUser(user),
      accessToken,
      refreshToken: newRefresh,
      sessionId: decoded.sid,
      absoluteExpiresAt: absoluteExpiresAt.toISOString(),
    };
  },

  /** Revoca la sesión local del access token actual. */
  async logout(accessToken: string): Promise<void> {
    let sid: string | null = null;
    try {
      const decoded = verifySignedToken<JwtPayload>(accessToken);
      if (decoded.type === 'access' && decoded.sid) sid = decoded.sid;
    } catch {
      // Token inválido/expirado: no hay más que limpiar en cliente.
      return;
    }
    if (!sid) return;
    await authSessionRepository.revoke(sid, 'logout');
    notifyRevoked(sid);
  },

  async getProfile(userId: string): Promise<AuthUser> {
    const user = await authRepository.findByIdSafe(userId);
    if (!user) {
      throw new NotFoundError('Usuario', userId);
    }
    return toAuthUser(user);
  },

  async changePassword(_userId: string, _input: ChangePasswordInput): Promise<void> {
    throw new ForbiddenError(
      'La contraseña se gestiona en Microsoft Entra ID. No se puede cambiar desde el CRM.'
    );
  },

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthUser> {
    const user = await authRepository.findByIdSafe(userId);
    if (!user) {
      throw new NotFoundError('Usuario', userId);
    }
    const updated = await authRepository.updateProfile(userId, input);
    logger.info('Perfil actualizado', { userId });
    return toAuthUser(updated);
  },

  /**
   * Verifica access JWT + sesión local vigente + cuenta activa.
   * El rol efectivo sale de BD (no del claim).
   */
  async verifyAccessToken(token: string): Promise<AuthUser & { sessionId: string }> {
    const decoded = verifySignedToken<JwtPayload>(token);

    if (decoded.type !== 'access' || !decoded.sid) {
      throw new UnauthorizedError('Tipo de token inválido');
    }

    const session = await authSessionRepository.findById(decoded.sid);
    if (!session || !authSessionRepository.isActive(session)) {
      if (session && !session.revoked_at && session.absolute_expires_at.getTime() <= Date.now()) {
        await authSessionRepository.revoke(decoded.sid, 'absolute_expired');
      }
      notifyRevoked(decoded.sid);
      throw new UnauthorizedError('Sesión expirada o revocada');
    }

    if (session.user_id !== decoded.sub) {
      await authSessionRepository.revoke(decoded.sid, 'subject_mismatch');
      notifyRevoked(decoded.sid);
      throw new UnauthorizedError('Sesión inválida');
    }

    await assertCentralSessionActive(session);

    const user = await authRepository.findByIdSafe(decoded.sub);
    if (!user) {
      throw new UnauthorizedError('Usuario no encontrado');
    }
    if (!user.isActive) {
      await authSessionRepository.revokeAllForUser(user.id, 'user_disabled');
      notifyRevoked(decoded.sid);
      throw new ForbiddenError('Cuenta desactivada');
    }

    return { ...toAuthUser(user), sessionId: decoded.sid };
  },

  /** Webhook ENTRA: revoca sesiones locales ligadas al sessionRef. */
  async revokeByEntraSessionRef(sessionRef: string): Promise<string[]> {
    invalidateIntrospect(sessionRef);
    const sids = await authSessionRepository.revokeByEntraSessionRef(sessionRef, 'entra_revoked');
    for (const sid of sids) {
      notifyRevoked(sid);
    }
    return sids;
  },
};

/** Exportado para tests unitarios de hash/duración. */
export const authSessionCrypto = { hashToken, parseDurationToMs };
