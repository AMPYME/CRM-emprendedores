/**
 * Repositorio de usuarios para el módulo de autenticación.
 * Queries Prisma para operaciones sobre la tabla users.
 */
import { User, UserRole } from '@prisma/client';
import { prisma } from '../../config/database';

/**
 * Campos seguros a retornar (sin passwordHash).
 */
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type SafeUser = Pick<
  User,
  'id' | 'email' | 'firstName' | 'lastName' | 'role' | 'isActive' | 'lastLoginAt' | 'createdAt' | 'updatedAt'
>;

export const authRepository = {
  /**
   * Buscar usuario por email (incluye passwordHash para verificación).
   */
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  },

  /**
   * Buscar usuario por ID (incluye passwordHash para cambio de contraseña).
   */
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  },

  /**
   * Buscar usuario por ID (sin passwordHash — seguro para respuestas).
   */
  async findByIdSafe(id: string): Promise<SafeUser | null> {
    return prisma.user.findFirst({
      where: { id },
      select: SAFE_USER_SELECT,
    });
  },

  /**
   * Crear nuevo usuario.
   */
  async create(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    role?: UserRole;
  }): Promise<SafeUser> {
    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || 'OPERATOR',
      },
      select: SAFE_USER_SELECT,
    });
  },

  /**
   * Actualizar último login.
   */
  async updateLastLogin(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  },

  /**
   * Actualizar contraseña.
   */
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  },

  /**
   * Actualizar perfil (nombre, apellido).
   */
  async updateProfile(
    id: string,
    data: { firstName?: string; lastName?: string }
  ): Promise<SafeUser> {
    return prisma.user.update({
      where: { id },
      data,
      select: SAFE_USER_SELECT,
    });
  },

  /**
   * Verificar si existe un usuario con ese email.
   */
  async existsByEmail(email: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { email },
    });
    return count > 0;
  },
};
