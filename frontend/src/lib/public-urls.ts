/**
 * URLs públicas (NEXT_PUBLIC_*).
 *
 * En el navegador las llamadas REST SIEMPRE van same-origin a `/backend-api`
 * (nginx delante o rewrite de Next). Así no hay CORS aunque el front se abra
 * por http://10.14.86.10 y el API esté en otra IP.
 *
 * El destino real del proxy se define en build (`API_PROXY_TARGET` /
 * `NEXT_PUBLIC_API_URL`) y puede sobrescribirse en runtime vía entrypoint.
 */
export function toPageProtocol(url: string): string {
  if (!url) return url;
  if (typeof window === 'undefined') return url;
  if (window.location.protocol !== 'https:') return url;
  if (url.startsWith('https:') || url.startsWith('wss:')) return url;
  if (url.startsWith('http://')) return `https://${url.slice('http://'.length)}`;
  if (url.startsWith('ws://')) return `wss://${url.slice('ws://'.length)}`;
  return url;
}

function configuredApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://10.14.80.245/api/v1';
}

export function publicApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/backend-api`;
  }
  return configuredApiUrl();
}
