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
   * API interna de usuarios (AD-user-api). Obligatoria: el CRM solo autentica vía AD.
   * Ej: http://api-adusers.ampyme.local
   */
  adApiBaseUrl: (process.env.AD_API_BASE_URL || '').trim() || undefined,

  /** Si el usuario AD no existe en el CRM, crearlo con rol EMPREND_OPERADOR. */
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
  adRequiredAppRoleSlugs: (process.env.AD_REQUIRED_APP_ROLES || 'EMPREND_OPERADOR,EMPREND_VIEWER,EMPREND_ADMIN,ADMIN,SUPER_ADMIN')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean),

  adSkipRoleCheck: process.env.AD_SKIP_ROLE_CHECK === 'true',

  // ── Intake de Emprendedores (PostgreSQL temporal → WebSocket → CRM) ──
  /** Ruta del servidor WebSocket de intake. */
  wsPath: requiredEnv('WS_PATH', '/ws/intake'),

  /** Minutos de inactividad tras los que expira una sesión de intake. */
  intakeSessionTtlMin: parseInt(requiredEnv('INTAKE_SESSION_TTL_MIN', '20'), 10),

  /** MySQL de formularios AMPYME (lectura directa, misma BD que forms-app). */
  formsMysql: {
    host: (process.env.FORMS_MYSQL_HOST || '192.168.2.184').trim(),
    port: parseInt(process.env.FORMS_MYSQL_PORT || '3306', 10),
    user: (process.env.FORMS_MYSQL_USER || '').trim(),
    password: process.env.FORMS_MYSQL_PASSWORD || '',
    database: (process.env.FORMS_MYSQL_DATABASE || 'forms_ampyme').trim(),
  },

  /** Importaciones Excel: tamaño de lote y pausa entre lotes (evita saturar el servidor). */
  importBatchSize: parseInt(process.env.IMPORT_BATCH_SIZE || '25', 10),
  importBatchDelayMs: parseInt(process.env.IMPORT_BATCH_DELAY_MS || '150', 10),
  importStagingInsertBatchSize: parseInt(process.env.IMPORT_STAGING_INSERT_BATCH_SIZE || '200', 10),
} as const;

export type Config = typeof config;
