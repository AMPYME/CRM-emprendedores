/**
 * WebSocket de intake.
 *
 * Operadores: JWT en `?token=` → sesión local (sid) revalidada en heartbeat.
 * Público: sin JWT; limitado a una sesión con sid + accessCode.
 *
 * Un JWT válido no convierte automáticamente a viewer en operador de cola:
 * subscribe_queue exige rol de operador (no EMPREND_VIEWER).
 */
import { IncomingMessage } from 'http';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from '../../config/environment';
import { logger } from '../../shared/logger/logger';
import { authService, registerSessionRevokedHandler } from '../auth/auth.service';
import { isReadOnlyCrmRole } from '../auth/ad-auth.mapper';
import { intakeRepository } from './intake.repository';
import { IntakeSnapshot, IntakeWsEvent } from './intake.types';
import { verifyAccessCode } from './intake-access';

interface IntakeClient extends WebSocket {
  isAlive?: boolean;
  sessionId?: string;
  queueWatch?: boolean;
  role?: 'operator' | 'public';
  authSid?: string;
  userId?: string;
  userRole?: string;
  accessToken?: string;
}

class IntakeWsServer {
  private wss: WebSocketServer | null = null;
  private revalidateTimer: ReturnType<typeof setInterval> | null = null;

  init(server: HttpServer): void {
    if (this.wss) return;
    this.wss = new WebSocketServer({ server, path: config.wsPath });

    registerSessionRevokedHandler((sid) => this.closeByAuthSid(sid));

    this.wss.on('connection', (ws: IntakeClient, req: IncomingMessage) => {
      void this.handleConnection(ws, req);
    });

    const heartbeat = setInterval(() => {
      this.wss?.clients.forEach((client) => {
        const c = client as IntakeClient;
        if (c.isAlive === false) {
          c.terminate();
          return;
        }
        c.isAlive = false;
        c.ping();
      });
    }, 30000);

    this.revalidateTimer = setInterval(() => {
      void this.revalidateOperatorSessions();
    }, 60000);

    this.wss.on('close', () => {
      clearInterval(heartbeat);
      if (this.revalidateTimer) clearInterval(this.revalidateTimer);
    });
    logger.info(`🔌 WebSocket intake escuchando en ${config.wsPath}`);
  }

  closeByAuthSid(authSid: string): void {
    this.wss?.clients.forEach((client) => {
      const c = client as IntakeClient;
      if (c.authSid === authSid && c.readyState === WebSocket.OPEN) {
        this.send(c, { type: 'error', message: 'Sesión revocada' });
        c.close(4001, 'session_revoked');
      }
    });
  }

  private async revalidateOperatorSessions(): Promise<void> {
    if (!this.wss) return;
    const tasks: Promise<void>[] = [];
    this.wss.clients.forEach((client) => {
      const c = client as IntakeClient;
      if (c.role !== 'operator' || !c.accessToken || c.readyState !== WebSocket.OPEN) return;
      tasks.push(
        (async () => {
          try {
            const user = await authService.verifyAccessToken(c.accessToken!);
            c.userRole = user.role;
            c.userId = user.id;
            c.authSid = user.sessionId;
            if (isReadOnlyCrmRole(user.role) && c.queueWatch) {
              c.queueWatch = false;
              this.send(c, { type: 'error', message: 'Rol de solo lectura: cola desuscrita' });
            }
          } catch {
            this.send(c, { type: 'error', message: 'Sesión expirada' });
            c.close(4001, 'unauthorized');
          }
        })()
      );
    });
    await Promise.allSettled(tasks);
  }

  private async handleConnection(ws: IntakeClient, req: IncomingMessage): Promise<void> {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    const pending: Buffer[] = [];
    let ready = false;

    const handleMessage = (raw: Buffer) => {
      let msg: { action?: string; sessionId?: string; accessCode?: string };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.action === 'subscribe' && msg.sessionId) {
        void this.subscribe(ws, msg.sessionId, msg.accessCode);
      } else if (msg.action === 'subscribe_queue') {
        void this.subscribeQueue(ws);
      } else if (msg.action === 'unsubscribe') {
        ws.sessionId = undefined;
        ws.queueWatch = false;
      }
    };

    ws.on('message', (raw) => {
      if (!ready) {
        pending.push(raw as Buffer);
        return;
      }
      handleMessage(raw as Buffer);
    });

    const url = new URL(req.url || '', 'http://localhost');
    const token = url.searchParams.get('token') || '';
    const sid = url.searchParams.get('sid') || '';
    const accessCode = url.searchParams.get('accessCode') || '';

    if (token) {
      try {
        const user = await authService.verifyAccessToken(token);
        if (isReadOnlyCrmRole(user.role)) {
          // Viewer puede observar una sesión concreta, no operar la cola.
          ws.role = 'operator';
          ws.userRole = user.role;
        } else {
          ws.role = 'operator';
          ws.userRole = user.role;
        }
        ws.authSid = user.sessionId;
        ws.userId = user.id;
        ws.accessToken = token;
      } catch {
        this.send(ws, { type: 'error', message: 'Token inválido' });
        ws.close(4001, 'unauthorized');
        return;
      }
    } else {
      ws.role = 'public';
    }

    ready = true;
    for (const raw of pending) handleMessage(raw);

    if (!token && sid && accessCode) {
      void this.subscribe(ws, sid, accessCode);
    }
  }

  private async subscribe(ws: IntakeClient, sessionId: string, accessCode?: string): Promise<void> {
    if (ws.role === 'operator' && ws.accessToken) {
      try {
        const user = await authService.verifyAccessToken(ws.accessToken);
        ws.userRole = user.role;
        ws.authSid = user.sessionId;
      } catch {
        this.send(ws, { type: 'error', message: 'Sesión expirada' });
        ws.close(4001, 'unauthorized');
        return;
      }
    }

    if (ws.role === 'public' && ws.sessionId && ws.sessionId !== sessionId) {
      this.send(ws, {
        type: 'access_denied',
        sessionId,
        message: 'La suscripción pública está limitada a una sola sesión',
      });
      return;
    }

    const session = await intakeRepository.getSession(sessionId);
    if (!session) {
      this.send(ws, { type: 'access_denied', sessionId, message: 'Sesión no encontrada' });
      return;
    }
    if (ws.role !== 'operator') {
      if (!verifyAccessCode(accessCode || '', session.access_code_hash)) {
        this.send(ws, { type: 'access_denied', sessionId, message: 'Código de acceso incorrecto' });
        return;
      }
    } else if (accessCode?.trim() && !verifyAccessCode(accessCode, session.access_code_hash)) {
      this.send(ws, { type: 'access_denied', sessionId, message: 'Código de acceso incorrecto' });
      return;
    }
    if (session.status === 'EXPIRED' || new Date(session.expires_at) < new Date()) {
      this.send(ws, { type: 'expired', sessionId });
      return;
    }

    ws.sessionId = sessionId;
    this.send(ws, { type: 'subscribed', sessionId });

    const snapshot = await intakeRepository.getSnapshot(sessionId);
    if (snapshot) {
      this.send(ws, { type: 'snapshot', snapshot });
    }
  }

  private async subscribeQueue(ws: IntakeClient): Promise<void> {
    if (ws.role !== 'operator' || !ws.accessToken) {
      this.send(ws, { type: 'error', message: 'Solo operadores pueden suscribirse a la cola' });
      return;
    }
    try {
      const user = await authService.verifyAccessToken(ws.accessToken);
      ws.userRole = user.role;
      ws.authSid = user.sessionId;
      if (isReadOnlyCrmRole(user.role)) {
        this.send(ws, { type: 'error', message: 'Su rol no puede operar la cola de verificación' });
        return;
      }
    } catch {
      this.send(ws, { type: 'error', message: 'Sesión expirada' });
      ws.close(4001, 'unauthorized');
      return;
    }
    ws.queueWatch = true;
    this.send(ws, { type: 'queue_subscribed' });
  }

  private send(ws: WebSocket, event: IntakeWsEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  private forSession(sessionId: string, fn: (client: IntakeClient) => void): void {
    this.wss?.clients.forEach((client) => {
      const c = client as IntakeClient;
      if (c.sessionId === sessionId && c.readyState === WebSocket.OPEN) {
        fn(c);
      }
    });
  }

  notifySnapshot(snapshot: IntakeSnapshot): void {
    this.forSession(snapshot.sessionId, (c) => {
      this.send(c, { type: 'snapshot', snapshot });
    });
  }

  notifyExpired(sessionId: string): void {
    this.forSession(sessionId, (c) => {
      this.send(c, { type: 'expired', sessionId });
    });
  }

  notifyValidated(sessionId: string): void {
    this.forSession(sessionId, (c) => {
      this.send(c, { type: 'validated', sessionId });
    });
  }

  notifyQueueChanged(reason?: string): void {
    this.wss?.clients.forEach((client) => {
      const c = client as IntakeClient;
      if (c.queueWatch && c.readyState === WebSocket.OPEN) {
        this.send(c, { type: 'queue_changed', reason });
      }
    });
  }
}

export const intakeWs = new IntakeWsServer();
