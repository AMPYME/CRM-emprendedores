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
  corsOrigin: requiredEnv('CORS_ORIGIN', 'http://192.168.99.60:3000'),

  // Logging
  logLevel: requiredEnv('LOG_LEVEL', 'debug'),
  logDir: requiredEnv('LOG_DIR', './logs'),

  // Uploads
  uploadDir: requiredEnv('UPLOAD_DIR', './uploads'),
  maxFileSizeMb: parseInt(requiredEnv('MAX_FILE_SIZE_MB', '10'), 10),

  // Rate Limiting
  rateLimitWindowMs: parseInt(requiredEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10),
  rateLimitMaxRequests: parseInt(requiredEnv('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
} as const;

export type Config = typeof config;
