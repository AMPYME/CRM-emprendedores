/**
 * Estado global de la aplicación.
 * Variables compartidas entre módulos (estado de BD, etc.).
 * Evita dependencias circulares al importar desde server.ts.
 */

export const appState = {
  isDatabaseConnected: false,
};
