/**
 * Cliente Prisma singleton.
 * Evita múltiples instancias en desarrollo con hot-reload.
 */
import { PrismaClient } from '@prisma/client';
import { config } from './environment';
import { registerSoftDelete } from './soft-delete';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrisma(): PrismaClient {
  const client = new PrismaClient({
    log:
      config.nodeEnv === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
  });
  registerSoftDelete(client);
  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (config.nodeEnv !== 'production') {
  globalForPrisma.prisma = prisma;
}
