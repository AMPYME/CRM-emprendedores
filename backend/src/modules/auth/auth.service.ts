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
  namesFromAdProfile,
  hasAnyRequiredAdRole,
} from './ad-auth.mapper';
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
  JwtPayload,
  JwtRefreshPayload,
} from './auth.types';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from '../../shared/errors/app-error';
import { logger } from '../../shared/logger/logger';

const SALT_ROUNDS = 12;

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
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

// ── Servicio exportado ──────────────────────────────────────────

async function loginWithLocalPassword(
  email: string,
  password: string
): Promise<AuthTokenResponse> {
  const user = await authRepository.findByEmail(email);

  if (!user) {
    throw new UnauthorizedError('Credenciales inválidas');
  }

  if (!user.isActive) {
    throw new ForbiddenError('Cuenta desactivada. Contacte al administrador');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Credenciales inválidas');
  }

  await authRepository.updateLastLogin(user.id);

  const safeUser: SafeUser = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: new Date(),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  const accessToken = generateAccessToken(safeUser);
  const refreshToken = generateRefreshToken(safeUser);

  logger.info('Login exitoso (local)', { userId: user.id, email: user.email });

  return {
    user: toAuthUser(safeUser),
    accessToken,
    refreshToken,
  };
}

export const authService = {
  /**
   * Login: si AD_API_BASE_URL está definida, valida primero contra la API interna de usuarios;
   * si no hay AD o falla (según AD_AUTH_FALLBACK_LOCAL), usa usuario/contraseña locales.
   */
  async login(input: LoginInput): Promise<AuthTokenResponse> {
    const identifier = input.email;

    if (config.adApiBaseUrl) {
      const adOutcome = await adLogin(config.adApiBaseUrl, identifier, input.password);

      if (adOutcome.kind === 'success') {
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
          const placeholderHash = await bcrypt.hash(randomUUID(), 12);
          const created = await authRepository.create({
            email: emailResolved,
            passwordHash: placeholderHash,
            firstName,
            lastName,
            role: 'OPERATOR',
          });
          await authRepository.updateLastLogin(created.id);
          const safe = await authRepository.findByIdSafe(created.id);
          if (!safe) {
            throw new UnauthorizedError('Error al crear sesión tras alta por AD');
          }
          const accessToken = generateAccessToken(safe);
          const refreshToken = generateRefreshToken(safe);
          logger.info('Login exitoso (AD + alta automática)', {
            userId: safe.id,
            email: safe.email,
          });
          return {
            user: toAuthUser(safe),
            accessToken,
            refreshToken,
          };
        }

        if (!user.isActive) {
          throw new ForbiddenError('Cuenta desactivada. Contacte al administrador');
        }

        await authRepository.updateLastLogin(user.id);
        const safeUser: SafeUser = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          lastLoginAt: new Date(),
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };
        const accessToken = generateAccessToken(safeUser);
        const refreshToken = generateRefreshToken(safeUser);
        logger.info('Login exitoso (AD)', { userId: user.id, email: user.email });
        return {
          user: toAuthUser(safeUser),
          accessToken,
          refreshToken,
        };
      }

      if (config.adAuthFallbackLocal) {
        return loginWithLocalPassword(identifier, input.password);
      }

      if (adOutcome.kind === 'unavailable') {
        logger.error('Login abortado: API de usuarios AD no disponible', {
          adApiBaseUrl: config.adApiBaseUrl,
        });
        throw new UnauthorizedError(
          'No se pudo contactar el servicio de autenticación corporativa. Intente más tarde.'
        );
      }

      throw new UnauthorizedError('Credenciales inválidas');
    }

    return loginWithLocalPassword(identifier, input.password);
  },

  /**
   * Registro: crea un nuevo usuario y retorna tokens.
   */
  async register(input: RegisterInput): Promise<AuthTokenResponse> {
    // Verificar que el email no esté en uso
    const emailExists = await authRepository.existsByEmail(input.email);
    if (emailExists) {
      throw new ConflictError('Ya existe un usuario con ese correo electrónico');
    }

    // Hash de contraseña
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    // Crear usuario
    const newUser = await authRepository.create({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
    });

    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    logger.info('Registro exitoso', { userId: newUser.id, email: newUser.email });

    return {
      user: toAuthUser(newUser),
      accessToken,
      refreshToken,
    };
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
   * Cambiar contraseña del usuario autenticado.
   */
  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('Usuario', userId);
    }

    // Verificar contraseña actual
    const isCurrentValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new BadRequestError('La contraseña actual es incorrecta');
    }

    // Hash de nueva contraseña
    const newHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
    await authRepository.updatePassword(userId, newHash);

    logger.info('Contraseña cambiada', { userId });
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
