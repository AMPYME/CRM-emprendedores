/**
 * Servicio de autenticación.
 * Maneja JWT, hashing de contraseñas, login, registro y refresh.
 */
import { randomUUID } from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../../config/environment';
import { authRepository, SafeUser } from './auth.repository';
import { adLogin, adGetMe } from './ad-user-api.client';
import {
  resolveEmailForLocalUser,
  resolveUsername,
  namesFromAdProfile,
  hasAnyRequiredAdRole,
  mapAdRolesToCrmRole,
  isFullAccessRole,
} from './ad-auth.mapper';
import { UserRole } from '@prisma/client';
import {
  LoginInput,
  RegisterInput,
  RefreshInput,
  ChangePasswordInput,
  UpdateProfileInput,
} from './auth.validator';
import {
  AuthUser,
  AuthTokenResponse,
  PublicAuthUser,
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
    sede: user.sede && !user.sede.deletedAt
      ? { id: user.sede.id, name: user.sede.name }
      : null,
    departamento: user.departamento && !user.departamento.deletedAt
      ? { id: user.departamento.id, name: user.departamento.name }
      : null,
  };
}

function toClientUser(user: SafeUser): PublicAuthUser {
  const { email: _email, ...client } = toAuthUser(user);
  return client;
}

// ── Servicio exportado ──────────────────────────────────────────

/**
 * Sincroniza el rol CRM desde AD.
 * Si AD solo mapea a EMPREND_OPERADOR, no degrada un usuario local con acceso total.
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
   * Login exclusivo vía Active Directory (AD-userAPI).
   * No hay autenticación local por contraseña en el CRM.
   */
  async login(input: LoginInput): Promise<AuthTokenResponse> {
    const identifier = input.email;

    if (!config.adApiBaseUrl) {
      throw new UnauthorizedError(
        'Autenticación no disponible: configure AD_API_BASE_URL (solo login corporativo).'
      );
    }

    const adOutcome = await adLogin(config.adApiBaseUrl, identifier, input.password);

    if (adOutcome.kind === 'invalid_credentials') {
      throw new UnauthorizedError('Credenciales inválidas');
    }

    if (adOutcome.kind === 'unavailable') {
      throw new UnauthorizedError(
        'No se pudo contactar el servicio de autenticación corporativa. Intente más tarde.'
      );
    }

    const adTokens = adOutcome.tokens;
    const me = await adGetMe(config.adApiBaseUrl, adTokens.accessToken);
    if (!me) {
      throw new UnauthorizedError(
        'No se pudo obtener el perfil desde la API de usuarios corporativa'
      );
    }

    const adRoles = me.roleNames ?? [];
    if (
      !config.adSkipRoleCheck &&
      !hasAnyRequiredAdRole(adRoles, config.adRequiredAppRoleSlugs)
    ) {
      throw new ForbiddenError(
        'No tiene acceso a este sistema. Se requiere el rol de aplicación adecuado (Emprendedores CRM).'
      );
    }

    const emailResolved = resolveEmailForLocalUser(
      me,
      identifier,
      config.adEmailDomain
    );
    if (!emailResolved) {
      throw new UnauthorizedError(
        'No se pudo determinar el correo del usuario. Configure AD_EMAIL_DOMAIN si usa solo nombre de usuario.'
      );
    }

    let user = await authRepository.findByEmail(emailResolved);

    if (!user) {
      if (!config.adAutoProvision) {
        throw new ForbiddenError(
          'Usuario no registrado en el CRM. Solicite acceso al administrador.'
        );
      }
      const { firstName, lastName } = namesFromAdProfile(me);
      const username = resolveUsername(me, identifier);
      const placeholderHash = await bcrypt.hash(randomUUID(), 12);
      const crmRole = mapAdRolesToCrmRole(adRoles);
      const created = await authRepository.create({
        email: emailResolved,
        passwordHash: placeholderHash,
        firstName,
        lastName,
        username,
        role: crmRole,
      });
      const safe = await authRepository.updateLastLogin(created.id);
      const accessToken = generateAccessToken(safe);
      const refreshToken = generateRefreshToken(safe);
      logger.info('Login exitoso (AD + alta automática)', {
        userId: safe.id,
        email: safe.email,
      });
      await logLogin(safe);
      return {
        user: toClientUser(safe),
        accessToken,
        refreshToken,
        adAccessToken: adTokens.accessToken,
      };
    }

    if (!user.isActive) {
      throw new ForbiddenError('Cuenta desactivada. Contacte al administrador');
    }

    const roleSync = resolveAdRoleSync(adRoles, user.role);
    const safeUser = await authRepository.updateLastLogin(user.id, roleSync, resolveUsername(me, identifier));
    const accessToken = generateAccessToken(safeUser);
    const refreshToken = generateRefreshToken(safeUser);
    logger.info('Login exitoso (AD)', { userId: user.id, email: user.email });
    await logLogin(safeUser);
    return {
      user: toClientUser(safeUser),
      accessToken,
      refreshToken,
      adAccessToken: adTokens.accessToken,
    };
  },

  /**
   * Registro local deshabilitado: el alta de usuarios es vía AD + provisionamiento.
   */
  async register(_input: RegisterInput): Promise<AuthTokenResponse> {
    throw new ForbiddenError(
      'El registro local está deshabilitado. Use el inicio de sesión corporativo (Active Directory).'
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
      user: toClientUser(user),
      accessToken,
      refreshToken,
    };
  },

  /**
   * Obtener perfil del usuario autenticado.
   */
  async getProfile(userId: string): Promise<PublicAuthUser> {
    const user = await authRepository.findByIdSafe(userId);
    if (!user) {
      throw new NotFoundError('Usuario', userId);
    }
    return toClientUser(user);
  },

  /**
   * Cambio de contraseña deshabilitado: la contraseña se gestiona en Active Directory.
   */
  async changePassword(_userId: string, _input: ChangePasswordInput): Promise<void> {
    throw new ForbiddenError(
      'La contraseña se gestiona en Active Directory. No se puede cambiar desde el CRM.'
    );
  },

  /**
   * Actualizar perfil del usuario autenticado.
   */
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicAuthUser> {
    const user = await authRepository.findByIdSafe(userId);
    if (!user) {
      throw new NotFoundError('Usuario', userId);
    }

    const updated = await authRepository.updateProfile(userId, input);
    logger.info('Perfil actualizado', { userId });
    return toClientUser(updated);
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
