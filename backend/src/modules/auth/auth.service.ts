/**
 * Servicio de autenticación.
 * Maneja JWT, hashing de contraseñas, login, registro y refresh.
 */
import { randomUUID } from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../../config/environment';
import { authRepository, SafeUser } from './auth.repository';
import { exchangeEntraCode } from './entra-user-api.client';
import {
  resolveEmailForLocalUser,
  resolveUsername,
  namesFromDirectoryProfile,
  hasAnyRequiredAdRole,
  mapAdRolesToCrmRole,
  isFullAccessRole,
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
} from '../../shared/errors/app-error';
import { logger } from '../../shared/logger/logger';
import { auditService } from '../audit/audit.service';

const SALT_ROUNDS = 12;

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
    // No bloquear el login si la auditoría falla (esquema incompleto, etc.).
    logger.warn('No se pudo registrar LOGIN en auditoría', {
      userId: user.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// ── Helpers de JWT ──────────────────────────────────────────────

function generateAccessToken(user: SafeUser): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    type: 'access',
  };

  const options: SignOptions = {
    expiresIn: config.jwtExpiresIn as any,
  };

  return jwt.sign(payload, config.jwtSecret, options);
}

function generateRefreshToken(user: SafeUser): string {
  const payload: JwtRefreshPayload = {
    sub: user.id,
    type: 'refresh',
  };

  const options: SignOptions = {
    expiresIn: config.jwtRefreshExpiresIn as any,
  };

  return jwt.sign(payload, config.jwtSecret, options);
}

function verifyToken<T>(token: string): T {
  try {
    return jwt.verify(token, config.jwtSecret) as T;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token expirado');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Token inválido');
    }
    throw new UnauthorizedError('Error al verificar token');
  }
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

// ── Servicio exportado ──────────────────────────────────────────

/**
 * Sincroniza el rol CRM desde Entra.
 * Si Entra solo mapea a EMPREND_OPERADOR, no degrada un usuario local con acceso total.
 */
function resolveAdRoleSync(adRoles: string[], currentRole: UserRole): UserRole | undefined {
  const mapped = mapAdRolesToCrmRole(adRoles) as UserRole;
  if (mapped === 'EMPREND_OPERADOR' && isFullAccessRole(currentRole)) {
    return undefined;
  }
  return mapped;
}

export const authService = {
  /**
   * Canjea el código de un solo uso de Entra y abre la sesión propia del CRM.
   * El navegador no habla con /api/auth/exchange: el secreto queda en este backend.
   */
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
      const placeholderHash = await bcrypt.hash(randomUUID(), 12);
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
      const accessToken = generateAccessToken(safe);
      const refreshToken = generateRefreshToken(safe);
      logger.info('Login exitoso (Entra + alta automática)', {
        userId: safe.id,
        email: safe.email,
      });
      await logLogin(safe);
      return {
        user: toAuthUser(safe),
        accessToken,
        refreshToken,
      };
    }

    if (!user.isActive) {
      throw new ForbiddenError('Cuenta desactivada. Contacte al administrador');
    }

    const roleSync = resolveAdRoleSync(directoryRoles, user.role);
    const safeUser = await authRepository.updateLastLogin(user.id, roleSync, directoryUsername);
    const accessToken = generateAccessToken(safeUser);
    const refreshToken = generateRefreshToken(safeUser);
    logger.info('Login exitoso (Entra)', { userId: user.id, email: user.email });
    await logLogin(safeUser);
    return {
      user: toAuthUser(safeUser),
      accessToken,
      refreshToken,
    };
  },

  /**
   * Registro local deshabilitado: el alta es vía Entra y provisionamiento.
   */
  async register(_input: RegisterInput): Promise<AuthTokenResponse> {
    throw new ForbiddenError(
      'El registro local está deshabilitado. Use el inicio de sesión con Microsoft Entra ID.'
    );
  },

  /**
   * Refresh: genera nuevos tokens a partir de un refresh token válido.
   */
  async refresh(input: RefreshInput): Promise<AuthTokenResponse> {
    const decoded = verifyToken<JwtRefreshPayload>(input.refreshToken);

    if (decoded.type !== 'refresh') {
      throw new UnauthorizedError('Tipo de token inválido');
    }

    const user = await authRepository.findByIdSafe(decoded.sub);

    if (!user) {
      throw new UnauthorizedError('Usuario no encontrado');
    }

    if (!user.isActive) {
      throw new ForbiddenError('Cuenta desactivada');
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    logger.debug('Token renovado', { userId: user.id });

    return {
      user: toAuthUser(user),
      accessToken,
      refreshToken,
    };
  },

  /**
   * Obtener perfil del usuario autenticado.
   */
  async getProfile(userId: string): Promise<AuthUser> {
    const user = await authRepository.findByIdSafe(userId);
    if (!user) {
      throw new NotFoundError('Usuario', userId);
    }
    return toAuthUser(user);
  },

  /**
   * Cambio de contraseña deshabilitado: la contraseña se gestiona en Microsoft Entra ID.
   */
  async changePassword(_userId: string, _input: ChangePasswordInput): Promise<void> {
    throw new ForbiddenError(
      'La contraseña se gestiona en Microsoft Entra ID. No se puede cambiar desde el CRM.'
    );
  },

  /**
   * Actualizar perfil del usuario autenticado.
   */
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
   * Verificar un access token y retornar el usuario.
   * Usado internamente por el middleware protect.
   */
  async verifyAccessToken(token: string): Promise<AuthUser> {
    const decoded = verifyToken<JwtPayload>(token);

    if (decoded.type !== 'access') {
      throw new UnauthorizedError('Tipo de token inválido');
    }

    const user = await authRepository.findByIdSafe(decoded.sub);

    if (!user) {
      throw new UnauthorizedError('Usuario no encontrado');
    }

    if (!user.isActive) {
      throw new ForbiddenError('Cuenta desactivada');
    }

    return toAuthUser(user);
  },
};
