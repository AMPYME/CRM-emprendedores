/**
 * Coordinación de logout / época de sesión entre pestañas e interceptores.
 * Evita que un refresh tardío restaure tokens tras cerrar sesión.
 */
type AuthEvent = { type: 'logout'; epoch: number } | { type: 'block' };

const CHANNEL = 'crm-emprendedores-auth';

let epoch = 0;
let loggingOut = false;
let requestsBlocked = false;

type Listener = (event: AuthEvent) => void;
const listeners = new Set<Listener>();

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (msg: MessageEvent<AuthEvent>) => {
      if (!msg.data) return;
      if (msg.data.type === 'logout') {
        epoch = Math.max(epoch, msg.data.epoch);
        loggingOut = true;
        requestsBlocked = true;
      }
      listeners.forEach((l) => l(msg.data));
    };
  }
  return channel;
}

export function getAuthEpoch(): number {
  return epoch;
}

export function isAuthLoggingOut(): boolean {
  return loggingOut;
}

export function areProtectedRequestsBlocked(): boolean {
  return requestsBlocked || loggingOut;
}

export function beginLogout(): number {
  loggingOut = true;
  requestsBlocked = true;
  epoch += 1;
  const ev: AuthEvent = { type: 'logout', epoch };
  getChannel()?.postMessage(ev);
  listeners.forEach((l) => l(ev));
  return epoch;
}

export function blockProtectedRequests(): void {
  requestsBlocked = true;
  getChannel()?.postMessage({ type: 'block' } satisfies AuthEvent);
}

export function clearLogoutFlags(): void {
  loggingOut = false;
  requestsBlocked = false;
}

export function markAuthenticatedReady(): void {
  if (!loggingOut) {
    requestsBlocked = false;
  }
}

export function isStaleEpoch(captured: number): boolean {
  return captured !== epoch;
}

export function onAuthBroadcast(listener: Listener): () => void {
  getChannel();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Cierra WebSockets abiertos del origen actual (best-effort). */
export function closeAppWebSockets(): void {
  if (typeof window === 'undefined') return;
  // Los hooks de intake cierran al desmontar; forzar cierre de sockets vivos vía evento.
  window.dispatchEvent(new CustomEvent('crm:auth-logout'));
}
