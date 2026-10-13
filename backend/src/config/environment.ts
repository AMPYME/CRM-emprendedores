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
  maxFileSizeMb: parseInt(requiredEnv('MAX_FILE_SIZE_MB', '80'), 10),

  // Rate Limiting
  rateLimitWindowMs: parseInt(requiredEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10),
  /** Límite alto: el frontend hace polling de imports + healthchecks. */
  rateLimitMaxRequests: parseInt(requiredEnv('RATE_LIMIT_MAX_REQUESTS', '3000'), 10),

  /**
   * Login central de Entra. El backend canjea el código; el navegador solo inicia el login.
   * Desde Docker: http://host.docker.internal:8080. Desde el host: http://localhost:8080.
   */
  entraApiBaseUrl: (process.env.ENTRA_API_BASE_URL || '').trim() || undefined,
  entraClientId: (process.env.EMPRENDEDORES_CLIENT_ID || '00000000-0000-4000-8000-000000000004').trim(),
  entraClientSecret: (process.env.EMPRENDEDORES_APP_SECRET || '').trim() || undefined,

  /** Si el funcionario de Entra no existe en el CRM, crearlo. */
  entraAutoProvision: process.env.ENTRA_AUTO_PROVISION !== 'false',

  /**
   * Roles de Entra (POST /api/auth/exchange → roles). El usuario debe tener al menos uno.
   * ENTRA_SKIP_ROLE_CHECK=true desactiva la validación (solo desarrollo).
   */
  entraRequiredAppRoleSlugs: (process.env.ENTRA_REQUIRED_APP_ROLES || 'EMPREND_OPERADOR,EMPREND_VIEWER,EMPREND_ADMIN,ADMIN,SUPER_ADMIN')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean),

  entraSkipRoleCheck: process.env.ENTRA_SKIP_ROLE_CHECK === 'true',

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
  /** Filas de validación/dedup por ciclo (secuencial, no concurrente). */
  importBatchSize: parseInt(process.env.IMPORT_BATCH_SIZE || '500', 10),
  importBatchDelayMs: parseInt(process.env.IMPORT_BATCH_DELAY_MS || '100', 10),
  /** createMany staging: lotes de ~500 para memoria constante. */
  importStagingInsertBatchSize: parseInt(process.env.IMPORT_STAGING_INSERT_BATCH_SIZE || '500', 10),
} as const;

export type Config = typeof config;
