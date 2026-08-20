/**
 * Schemas de validación Zod para el módulo de autenticación.
 */
import { z } from 'zod';

// ── Login ───────────────────────────────────────────────────────
// `email` en el JSON es el identificador de inicio de sesión: correo UPN o usuario AD (según integración).
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Usuario o correo requerido')
    .transform((v) => v.trim().toLowerCase()),
  password: z
    .string()
    .min(1, 'La contraseña es requerida'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ── Registro de usuario ─────────────────────────────────────────
export const registerSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Formato de email inválido')
    .max(255, 'Email demasiado largo')
    .transform((v) => v.trim().toLowerCase()),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128, 'La contraseña es demasiado larga')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'La contraseña debe contener al menos una minúscula, una mayúscula y un dígito'
    ),
  firstName: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(100, 'Nombre demasiado largo')
    .trim(),
  lastName: z
    .string()
    .min(1, 'El apellido es requerido')
    .max(100, 'Apellido demasiado largo')
    .trim(),
  role: z
    .enum(['SUPER_ADMIN', 'ADMIN', 'EMPREND_ADMIN', 'EMPREND_OPERADOR', 'EMPREND_VIEWER'])
    .optional()
    .default('EMPREND_OPERADOR'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ── Refresh token ───────────────────────────────────────────────
export const refreshSchema = z.object({
  refreshToken: z
    .string()
    .min(1, 'El refresh token es requerido'),
});

export type RefreshInput = z.infer<typeof refreshSchema>;

// ── Cambio de contraseña ────────────────────────────────────────
export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'La contraseña actual es requerida'),
  newPassword: z
    .string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .max(128, 'La contraseña es demasiado larga')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'La nueva contraseña debe contener al menos una minúscula, una mayúscula y un dígito'
    ),
}).refine(
  (data) => data.currentPassword !== data.newPassword,
  {
    message: 'La nueva contraseña debe ser diferente a la actual',
    path: ['newPassword'],
  }
);

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ── Actualización de perfil ─────────────────────────────────────
export const updateProfileSchema = z.object({
  firstName: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(100, 'Nombre demasiado largo')
    .trim()
    .optional(),
  lastName: z
    .string()
    .min(1, 'El apellido es requerido')
    .max(100, 'Apellido demasiado largo')
    .trim()
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
