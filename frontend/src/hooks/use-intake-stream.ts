'use client';

import { useEffect, useState } from 'react';
import { getIntakeWsUrl, getPublicIntakeWsUrl, intakeService } from '@/services/intake.service';
import { PublicIntakeError, publicIntakeService } from '@/services/public-intake.service';
import type { IntakeSnapshot, IntakeWsEvent } from '@/types/intake.types';

export type IntakeStreamStatus = 'connecting' | 'live' | 'expired' | 'validated' | 'closed' | 'access_denied';

interface UseIntakeStream {
  snapshot: IntakeSnapshot | null;
  status: IntakeStreamStatus;
  connected: boolean;
  errorMessage: string | null;
}

function closeSocket(ws: WebSocket): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.close();
    return;
  }
  if (ws.readyState === WebSocket.CONNECTING) {
    ws.onopen = () => ws.close();
  }
}

function statusFromSnapshot(snap: IntakeSnapshot): IntakeStreamStatus {
  if (snap.status === 'EXPIRED') return 'expired';
  if (snap.status === 'VALIDATED') return 'validated';
  return 'live';
}

export function useIntakeStream(
  sessionId: string | undefined,
  accessCode: string | undefined,
  mode: 'operator' | 'public' = 'operator'
): UseIntakeStream {
  const [snapshot, setSnapshot] = useState<IntakeSnapshot | null>(null);
  const [status, setStatus] = useState<IntakeStreamStatus>('connecting');
  const [connected, setConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || (mode === 'public' && !accessCode)) {
      setSnapshot(null);
      setConnected(false);
      setStatus('closed');
      return;
    }

    let cancelled = false;
    let terminal = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let attempts = 0;

    const applySnapshot = (snap: IntakeSnapshot) => {
      if (cancelled || terminal) return;
      setSnapshot(snap);
      const next = statusFromSnapshot(snap);
      setStatus(next);
      if (next === 'expired' || next === 'validated') {
        terminal = true;
      }
    };

    const pollOnce = async () => {
      if (cancelled || terminal) return;
      try {
        if (mode === 'public') {
          const result = await publicIntakeService.getSession(sessionId, accessCode!);
          applySnapshot(result.snapshot);
        } else {
          const snap = await intakeService.getById(sessionId, accessCode);
          applySnapshot(snap);
        }
      } catch (err) {
        if (cancelled || terminal) return;
        const statusCode =
          err instanceof PublicIntakeError
            ? err.status
            : typeof err === 'object' && err && 'response' in err
              ? Number((err as { response?: { status?: number } }).response?.status)
              : 0;
        if (statusCode === 401 || statusCode === 403) {
          terminal = true;
          setStatus('access_denied');
          setErrorMessage(err instanceof Error ? err.message : 'Código de acceso incorrecto');
          setConnected(false);
          if (ws) closeSocket(ws);
        }
      }
    };

    const connect = () => {
      if (cancelled || terminal) return;

      try {
        ws = new WebSocket(
          mode === 'public' ? getPublicIntakeWsUrl(sessionId, accessCode!) : getIntakeWsUrl()
        );
      } catch {
        void pollOnce();
        return;
      }

      setStatus((s) => (s === 'expired' || s === 'validated' || s === 'live' ? s : 'connecting'));
      setErrorMessage(null);

      ws.onopen = () => {
        if (cancelled || terminal) {
          closeSocket(ws!);
          return;
        }
        attempts = 0;
        setConnected(true);
        ws!.send(JSON.stringify({ action: 'subscribe', sessionId, accessCode: accessCode || '' }));
      };

      ws.onmessage = (ev) => {
        let msg: IntakeWsEvent;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        switch (msg.type) {
          case 'snapshot':
            applySnapshot(msg.snapshot);
            break;
          case 'expired':
            terminal = true;
            setStatus('expired');
            break;
          case 'validated':
            terminal = true;
            setStatus('validated');
            break;
          case 'access_denied':
            // El operador con JWT puede seguir por REST aunque el WS pida código.
            if (mode === 'public') {
              terminal = true;
              setStatus('access_denied');
              setErrorMessage(msg.message);
              setConnected(false);
              ws?.close();
            }
            break;
          case 'error':
            setErrorMessage(msg.message);
            setConnected(false);
            break;
          case 'subscribed':
          default:
            break;
        }
      };

      ws.onclose = () => {
        if (cancelled || terminal) return;
        setConnected(false);
        setStatus((prev) => {
          if (prev === 'expired' || prev === 'validated' || prev === 'access_denied') return prev;
          const delay = Math.min(1000 * 2 ** attempts, 15000);
          attempts += 1;
          reconnectTimer = setTimeout(connect, delay);
          return prev === 'live' ? prev : 'connecting';
        });
      };

      ws.onerror = () => ws?.close();
    };

    setSnapshot(null);
    setStatus('connecting');
    setConnected(false);
    setErrorMessage(null);
    connect();
    void pollOnce();
    pollTimer = setInterval(() => {
      void pollOnce();
    }, 2500);

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pollTimer) clearInterval(pollTimer);
      if (ws) closeSocket(ws);
    };
  }, [sessionId, accessCode, mode]);

  return { snapshot, status, connected, errorMessage };
}
