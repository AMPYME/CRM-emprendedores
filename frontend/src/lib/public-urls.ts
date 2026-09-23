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

export function publicApiBaseUrl(): string {
  const configured = apiHttpUrl(
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'
  );
  if (typeof window === 'undefined') return configured;
  if (window.location.protocol === 'https:' && configured.startsWith('http://')) {
    return `${window.location.origin}/backend-api`;
  }
  return configured;
}
