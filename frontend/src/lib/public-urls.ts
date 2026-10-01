/**
 * URLs públicas incrustadas en el build (NEXT_PUBLIC_*).
 * En páginas HTTPS, las llamadas REST van al mismo origen (`/backend-api`)
 * para no bloquear mixed content. El rewrite de Next las reenvía al API.
 * WebSocket se sube de ws→wss cuando el API tiene TLS.
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

export function publicApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  if (typeof window === 'undefined') return configured;
  if (window.location.protocol === 'https:' && configured.startsWith('http:')) {
    return `${window.location.origin}/backend-api`;
  }
  return toPageProtocol(configured);
}
