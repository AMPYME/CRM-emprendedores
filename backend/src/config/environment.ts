/**
 * Configuración centralizada del entorno.
 * Lee variables de .env y exporta un objeto tipado e inmutable.
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requiredEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`⚠️ Variable de entorno requerida: ${key}`);
  }
  return value;
}

export const config = {
  // Servidor
  nodeEnv: requiredEnv('NODE_ENV', 'development'),
  port: parseInt(requiredEnv('PORT', '4000'), 10),
  apiPrefix: requiredEnv('API_PREFIX', '/api/v1'),

  // Base de datos
  databaseUrl: requiredEnv('DATABASE_URL'),

  // JWT
  jwtSecret: requiredEnv('JWT_SECRET', 'dev-secret-change-in-production'),
  jwtExpiresIn: requiredEnv('JWT_EXPIRES_IN', '24h'),
  jwtRefreshExpiresIn: requiredEnv('JWT_REFRESH_EXPIRES_IN', '7d'),

  // CORS
  // Soporta múltiples orígenes separados por coma (ver `src/app.ts`).
  // Defaults de desarrollo: localhost + loopback + IP LAN común.
  corsOrigin: requiredEnv(
    'CORS_ORIGIN',
    'http://localhost:3000,http://127.0.0.1:3000,http://192.168.99.60:3000'
  ),

  // Logging
  logLevel: requiredEnv('LOG_LEVEL', 'debug'),
  logDir: requiredEnv('LOG_DIR', './logs'),

  // Uploads
  uploadDir: requiredEnv('UPLOAD_DIR', './uploads'),
  maxFileSizeMb: parseInt(requiredEnv('MAX_FILE_SIZE_MB', '10'), 10),

  // Rate Limiting
  rateLimitWindowMs: parseInt(requiredEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10),
  rateLimitMaxRequests: parseInt(requiredEnv('RATE_LIMIT_MAX_REQUESTS', '100'), 10),

  /**
   * API interna de usuarios (AD-user-api). Si está definida, el login intenta primero AD.
   * Ej: http://api-adusers.ampyme.local
   */
  adApiBaseUrl: (process.env.AD_API_BASE_URL || '').trim() || undefined,

  /** Si AD falla (401/red), intentar login local con bcrypt (útil con usuarios seed en dev). */
  adAuthFallbackLocal: process.env.AD_AUTH_FALLBACK_LOCAL !== 'false',

  /** Si el usuario AD no existe en el CRM, crearlo con rol OPERATOR. */
  adAutoProvision: process.env.AD_AUTO_PROVISION !== 'false',

  /**
   * Dominio para armar email cuando el usuario escribe solo el login (sin @).
   * Ej: ampyme.gob.pa → usuario queda usuario@ampyme.gob.pa
   */
  adEmailDomain: (process.env.AD_EMAIL_DOMAIN || '').trim() || undefined,

  /**
   * Nombre(s) de rol en la API interna (GET /api/auth/me → user.roles, típicamente en MAYÚSCULAS en BD).
   * El usuario debe tener al menos uno (se normaliza a mayúsculas para comparar).
   * AD_SKIP_ROLE_CHECK=true desactiva la validación (solo desarrollo).
   */
  adRequiredAppRoleSlugs: (process.env.AD_REQUIRED_APP_ROLES || 'BD_EMPREND')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean),

  adSkipRoleCheck: process.env.AD_SKIP_ROLE_CHECK === 'true',
} as const;

export type Config = typeof config;
