/**
 * WebSocket de intake.
 *
 * El frontend del CRM se conecta a `config.wsPath` con su JWT (?token=...) y
 * envía { action: 'subscribe', sessionId }. El servidor hace polling corto a la
 * MySQL temporal por ese sid y emite `snapshot` cuando hay cambios, además de
 * `expired` / `validated`.
 *
 * PHP/Apache no mantiene WS persistentes, por eso vive aquí (Node).
 */
import { IncomingMessage } from 'http';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from '../../config/environment';
import { logger } from '../../shared/logger/logger';
import { authService } from '../auth/auth.service';
import { intakeRepository } from './intake.repository';
import { intakeService } from './intake.service';
import { IntakeWsEvent } from './intake.types';

const POLL_MS = 1500;

interface IntakeClient extends WebSocket {
  isAlive?: boolean;
  sessionId?: string;
  pollTimer?: ReturnType<typeof setInterval>;
  lastSignature?: string;
}

class IntakeWsServer {
  private wss: WebSocketServer | null = null;
  // Sesiones migradas recientemente, para distinguir validated de expired.
  private validatedRecently = new Set<string>();

  init(server: HttpServer): void {
    if (this.wss) return;
    this.wss = new WebSocketServer({ server, path: config.wsPath });

    this.wss.on('connection', (ws: IntakeClient, req: IncomingMessage) => {
      this.handleConnection(ws, req);
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

    // Registrar el handler antes de await: el cliente envía subscribe en onopen
    // y puede llegar antes de que termine verifyAccessToken.
    const pending: Buffer[] = [];
    let authed = false;

    const handleMessage = (raw: Buffer) => {
      let msg: { action?: string; sessionId?: string; accessCode?: string };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.action === 'subscribe' && msg.sessionId) {
        void this.subscribe(ws, msg.sessionId, msg.accessCode);
      } else if (msg.action === 'unsubscribe') {
        this.stopPolling(ws);
      }
    };

    ws.on('message', (raw) => {
      if (!authed) {
        pending.push(raw as Buffer);
        return;
      }
      handleMessage(raw as Buffer);
    });

    ws.on('close', () => this.stopPolling(ws));

    // Autenticación por JWT.
    try {
      const url = new URL(req.url || '', 'http://localhost');
      const token = url.searchParams.get('token') || '';
      if (!token) throw new Error('missing token');
      await authService.verifyAccessToken(token);
    } catch {
      this.send(ws, { type: 'error', message: 'Token inválido' });
      ws.close(4001, 'unauthorized');
      return;
    }

    authed = true;
    for (const raw of pending) handleMessage(raw);
  }

  private async subscribe(ws: IntakeClient, sessionId: string, accessCode?: string): Promise<void> {
    this.stopPolling(ws);
    try {
      await intakeService.verifyAccess(sessionId, accessCode || '');
    } catch {
      this.send(ws, { type: 'access_denied', sessionId, message: 'Código de acceso incorrecto' });
      return;
    }

    ws.sessionId = sessionId;
    ws.lastSignature = undefined;
    this.send(ws, { type: 'subscribed', sessionId });

    const tick = async () => {
      if (ws.readyState !== WebSocket.OPEN || ws.sessionId !== sessionId) return;
      try {
        const snapshot = await intakeRepository.getSnapshot(sessionId);

        if (!snapshot) {
          if (this.validatedRecently.has(sessionId)) {
            this.send(ws, { type: 'validated', sessionId });
          } else {
            this.send(ws, { type: 'expired', sessionId });
          }
          this.stopPolling(ws);
          return;
        }

        if (snapshot.status === 'EXPIRED') {
          this.send(ws, { type: 'expired', sessionId });
          this.stopPolling(ws);
          return;
        }

        const signature = `${snapshot.status}|${snapshot.lastActivityAt}`;
        if (signature !== ws.lastSignature) {
          ws.lastSignature = signature;
          this.send(ws, { type: 'snapshot', snapshot });
        }
      } catch (err) {
        logger.debug('[intake.ws] poll error', { sessionId, error: err });
      }
    };

    void tick();
    ws.pollTimer = setInterval(tick, POLL_MS);
  }

  private stopPolling(ws: IntakeClient): void {
    if (ws.pollTimer) {
      clearInterval(ws.pollTimer);
      ws.pollTimer = undefined;
    }
  }

  private send(ws: WebSocket, event: IntakeWsEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  /** Marca una sesión como recién validada (la llama el controller tras migrar). */
  notifyValidated(sessionId: string): void {
    this.validatedRecently.add(sessionId);
    setTimeout(() => this.validatedRecently.delete(sessionId), 10000);
    // Empuja inmediatamente a los suscriptores de esa sesión.
    this.wss?.clients.forEach((client) => {
      const c = client as IntakeClient;
      if (c.sessionId === sessionId && c.readyState === WebSocket.OPEN) {
        this.send(c, { type: 'validated', sessionId });
        this.stopPolling(c);
      }
    });
  }
}

export const intakeWs = new IntakeWsServer();
