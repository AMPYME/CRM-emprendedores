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

const nodeEnv = requiredEnv('NODE_ENV', 'development');
const isProduction = nodeEnv === 'production';

const jwtSecret = requiredEnv('JWT_SECRET', 'dev-secret-change-in-production');
const INSECURE_JWT_DEFAULTS = new Set([
  'dev-secret-change-in-production',
  'change-me',
  'secret',
]);

if (isProduction) {
  if (INSECURE_JWT_DEFAULTS.has(jwtSecret) || jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET inseguro o demasiado corto para producción (mín. 32 caracteres; no use el valor por defecto).'
    );
  }
  if (process.env.ENTRA_SKIP_ROLE_CHECK === 'true') {
    throw new Error('ENTRA_SKIP_ROLE_CHECK no está permitido en producción.');
  }
}

export const config = {
  nodeEnv,
  isProduction,
  port: parseInt(requiredEnv('PORT', '4000'), 10),
  apiPrefix: requiredEnv('API_PREFIX', '/api/v1'),

  databaseUrl: requiredEnv('DATABASE_URL'),

  jwtSecret,
  /** Access breve: reduce ventana tras revocación local. */
  jwtExpiresIn: requiredEnv('JWT_EXPIRES_IN', isProduction ? '15m' : '15m'),
  /**
   * TTL del JWT refresh (no desplaza la expiración absoluta de la sesión).
   * La sesión local tiene absoluteExpiresAt independiente.
   */
  jwtRefreshExpiresIn: requiredEnv('JWT_REFRESH_EXPIRES_IN', '8h'),
  /** Expiración absoluta de la sesión CRM local (no se renueva con refresh). */
  sessionAbsoluteTtl: requiredEnv('SESSION_ABSOLUTE_TTL', '8h'),
  jwtIssuer: requiredEnv('JWT_ISSUER', 'crm-emprendedores'),
  jwtAudience: requiredEnv('JWT_AUDIENCE', 'crm-emprendedores-api'),

  corsOrigin: requiredEnv(
    'CORS_ORIGIN',
    'http://localhost:3000,http://127.0.0.1:3000,http://192.168.99.60:3000'
  ),

  logLevel: requiredEnv('LOG_LEVEL', 'debug'),
  logDir: requiredEnv('LOG_DIR', './logs'),

  uploadDir: requiredEnv('UPLOAD_DIR', './uploads'),
  maxFileSizeMb: parseInt(requiredEnv('MAX_FILE_SIZE_MB', '80'), 10),

  rateLimitWindowMs: parseInt(requiredEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10),
  rateLimitMaxRequests: parseInt(requiredEnv('RATE_LIMIT_MAX_REQUESTS', '3000'), 10),

  entraApiBaseUrl: (process.env.ENTRA_API_BASE_URL || '').trim() || undefined,
  entraClientId: (process.env.EMPRENDEDORES_CLIENT_ID || '00000000-0000-4000-8000-000000000004').trim(),
  entraClientSecret: (process.env.EMPRENDEDORES_APP_SECRET || '').trim() || undefined,
  entraBrowserRedirect: (
    process.env.EMPRENDEDORES_OAUTH_REDIRECT || 'http://10.14.80.245/api/v1/auth/entra/callback'
  ).trim(),

  entraAutoProvision: process.env.ENTRA_AUTO_PROVISION !== 'false',

  entraRequiredAppRoleSlugs: (process.env.ENTRA_REQUIRED_APP_ROLES || 'EMPREND_OPERADOR,EMPREND_VIEWER,EMPREND_ADMIN,ADMIN,SUPER_ADMIN')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean),

  entraSkipRoleCheck: !isProduction && process.env.ENTRA_SKIP_ROLE_CHECK === 'true',

  /**
   * Política de roles: ENTRA gobierna el mapeo en cada exchange.
   * No se conservan privilegios locales superiores si ENTRA mapea a un rol inferior.
   */
  entraGovernsRoles: process.env.ENTRA_GOVERNS_ROLES !== 'false',

  /**
   * Caché positiva de POST /api/auth/introspect (solo active=true).
   * Es la ventana máxima de detección de revocación central sin webhook.
   */
  entraIntrospectCacheTtlMs: parseInt(process.env.ENTRA_INTROSPECT_CACHE_TTL_MS || '45000', 10),

  /** Secreto HMAC compartido con ENTRA (SESSION_REVOKE_HOOK_SECRET). */
  entraRevokeWebhookSecret: (process.env.ENTRA_REVOKE_WEBHOOK_SECRET || '').trim() || undefined,

  /**
   * Si true y hay sessionRef, protect/refresh exigen introspección activa.
   * Si ENTRA no soporta introspect aún, poner false temporalmente.
   */
  entraRequireIntrospect: process.env.ENTRA_REQUIRE_INTROSPECT !== 'false',

  wsPath: requiredEnv('WS_PATH', '/ws/intake'),
  intakeSessionTtlMin: parseInt(requiredEnv('INTAKE_SESSION_TTL_MIN', '20'), 10),

  formsMysql: {
    host: (process.env.FORMS_MYSQL_HOST || '192.168.2.184').trim(),
    port: parseInt(process.env.FORMS_MYSQL_PORT || '3306', 10),
    user: (process.env.FORMS_MYSQL_USER || '').trim(),
    password: process.env.FORMS_MYSQL_PASSWORD || '',
    database: (process.env.FORMS_MYSQL_DATABASE || 'forms_ampyme').trim(),
  },

  importBatchSize: parseInt(process.env.IMPORT_BATCH_SIZE || '500', 10),
  importBatchDelayMs: parseInt(process.env.IMPORT_BATCH_DELAY_MS || '100', 10),
  importStagingInsertBatchSize: parseInt(process.env.IMPORT_STAGING_INSERT_BATCH_SIZE || '500', 10),
} as const;

export type Config = typeof config;
