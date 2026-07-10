/**
 * Punto de entrada del servidor.
 * Carga variables de entorno, crea la app Express y levanta el servidor HTTP.
 *
 * El servidor arranca incluso si la BD no está disponible,
 * pero marca el estado como "degraded" para que healthcheck lo reporte.
 */
import http from 'http';
import { config } from './config/environment';
import { createApp } from './app';
import { logger } from './shared/logger/logger';
import { prisma } from './config/database';
import { appState } from './shared/state/app-state';
import { closeTempDb } from './config/temp-db';
import { intakeWs } from './modules/intake/intake.ws';
import { intakeService } from './modules/intake/intake.service';

async function bootstrap(): Promise<void> {
  // Intentar conexión a base de datos (no bloquea el arranque)
  try {
    await prisma.$connect();
    appState.isDatabaseConnected = true;
    logger.info('✅ Conexión a PostgreSQL establecida');
  } catch (error) {
    appState.isDatabaseConnected = false;
    logger.warn('⚠️ No se pudo conectar a PostgreSQL. El servidor arrancará sin BD.');
    logger.warn('   Asegúrate de tener PostgreSQL corriendo y ejecuta las migraciones.');
    if (error instanceof Error) {
      logger.warn(`   Detalle: ${error.message}`);
    }
  }

  try {
    const app = createApp();

    // Servidor HTTP explícito para poder adjuntar el WebSocket de intake.
    const server = http.createServer(app);
    intakeWs.init(server);
    intakeService.startExpirySweep();

    server.listen(config.port, () => {
      logger.info(`🚀 Servidor corriendo en http://localhost:${config.port}`);
      logger.info(`📋 API disponible en http://localhost:${config.port}${config.apiPrefix}`);
      logger.info(`🔌 WebSocket en ws://localhost:${config.port}${config.wsPath}`);
      logger.info(`🌍 Entorno: ${config.nodeEnv}`);
      if (!appState.isDatabaseConnected) {
        logger.warn('⚠️ Servidor en modo degradado (sin conexión a BD)');
      }
    });
  } catch (error) {
    logger.error('❌ Error fatal al iniciar el servidor:', error);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }
}

// Manejo de señales de cierre limpio
process.on('SIGTERM', async () => {
  logger.info('SIGTERM recibido. Cerrando servidor...');
  await prisma.$disconnect().catch(() => {});
  await closeTempDb();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT recibido. Cerrando servidor...');
  await prisma.$disconnect().catch(() => {});
  await closeTempDb();
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

bootstrap();
