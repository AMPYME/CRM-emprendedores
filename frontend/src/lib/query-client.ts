/**
 * Referencia al QueryClient de la app para limpiar caché al cerrar sesión
 * fuera de componentes React (p. ej. interceptor HTTP).
 */
import type { QueryClient } from '@tanstack/react-query';

let appQueryClient: QueryClient | null = null;

export function setAppQueryClient(client: QueryClient): void {
  appQueryClient = client;
}

export function clearPrivateQueryCache(): void {
  appQueryClient?.clear();
}
