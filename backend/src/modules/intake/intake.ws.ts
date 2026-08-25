/**
 * WebSocket de intake.
 *
 * Operadores del dashboard se conectan con JWT (`?token=`) y se suscriben
 * con `{ action: 'subscribe', sessionId, accessCode }`.
 *
 * El formulario público se conecta sin JWT y se limita a una sola sesión
 * mediante `sid` + `accessCode` (query o mensaje subscribe).
 *
 * Los eventos se emiten al guardar, enviar, expirar o validar — sin polling.
 */
import { IncomingMessage } from 'http';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from '../../config/environment';
import { logger } from '../../shared/logger/logger';
import { authService } from '../auth/auth.service';
import { intakeRepository } from './intake.repository';
import { IntakeSnapshot, IntakeWsEvent } from './intake.types';
import { verifyAccessCode } from './intake-access';

interface IntakeClient extends WebSocket {
  isAlive?: boolean;
  sessionId?: string;
  queueWatch?: boolean;
  role?: 'operator' | 'public';
}

class IntakeWsServer {
  private wss: WebSocketServer | null = null;

  init(server: HttpServer): void {
    if (this.wss) return;
    this.wss = new WebSocketServer({ server, path: config.wsPath });

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

    this.wss.on('close', () => clearInterval(heartbeat));
    logger.info(`🔌 WebSocket intake escuchando en ${config.wsPath}`);
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
        this.subscribeQueue(ws);
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
        await authService.verifyAccessToken(token);
        ws.role = 'operator';
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
    if (!verifyAccessCode(accessCode || '', session.access_code_hash)) {
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

  private subscribeQueue(ws: IntakeClient): void {
    if (ws.role !== 'operator') {
      this.send(ws, { type: 'error', message: 'Solo operadores pueden suscribirse a la cola' });
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

  /** Avisa a operadores en /dashboard/intake para refrescar la cola de verificación. */
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
