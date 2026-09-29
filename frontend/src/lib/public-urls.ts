/**
 * URLs públicas incrustadas en el build (NEXT_PUBLIC_*).
 * La API en Dokploy está publicada por HTTP. En una página HTTPS el navegador
 * no puede llamar http:// (mixed content): el REST sale por `/backend-api`
 * y el rewrite de Next lo reenvía al API por HTTP.
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

/** La ruta pública de la API es HTTP. No conservar un https incrustado en el build. */
export function apiHttpUrl(url: string): string {
  return url.replace(/^https:\/\//i, 'http://');
}

/**
 * Puerto del API visto desde el navegador.
 * Si la página se abre por el puerto 80 (o sin puerto), el API se llama en el 8000.
 * Si se abre por otro puerto (por ejemplo 3000), el API se llama en el 4000.
 */
export function devBrowserApiPort(): string {
  const lanPort = process.env.NEXT_PUBLIC_LAN_API_PORT || '8000';
  const directPort = process.env.NEXT_PUBLIC_DIRECT_API_PORT || '4000';
  if (typeof window === 'undefined') return directPort;
  const pagePort = window.location.port;
  if (pagePort === '' || pagePort === '80' || pagePort === '443') return lanPort;
  return directPort;
}

/**
 * En `next dev`, el navegador llama al backend en el mismo host que abrió
 * el frontend (localhost en esta PC, IP de Windows en otro equipo).
 * Así no intenta el localhost del cliente cuando se entra por la LAN.
 */
export function devBrowserServiceUrl(port: string, kind: 'http' | 'ws'): string | null {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') return null;
  const secure = window.location.protocol === 'https:';
  const proto = kind === 'ws' ? (secure ? 'wss:' : 'ws:') : (secure ? 'https:' : 'http:');
  return `${proto}//${window.location.hostname}:${port}`;
}

export function publicApiBaseUrl(): string {
  const configured = apiHttpUrl(
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'
  );
  if (typeof window === 'undefined') {
    return configured;
  }
  if (window.location.protocol === 'https:' && configured.startsWith('http://')) {
    return `${window.location.origin}/backend-api`;
  }
  const lan = devBrowserServiceUrl(devBrowserApiPort(), 'http');
  if (lan) return `${lan}/api/v1`;
  return configured;
}
