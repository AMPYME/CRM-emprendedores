'use client';

import { useEffect, useState } from 'react';
import { getIntakeWsUrl, getPublicIntakeWsUrl } from '@/services/intake.service';
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
    if (!sessionId || !accessCode) {
      setSnapshot(null);
      setConnected(false);
      setStatus('closed');
      return;
    }

    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const connect = () => {
      if (cancelled) return;

      try {
        ws = new WebSocket(
          mode === 'public' ? getPublicIntakeWsUrl(sessionId, accessCode) : getIntakeWsUrl()
        );
      } catch {
        if (!cancelled) setStatus('closed');
        return;
      }

      setStatus((s) => (s === 'expired' || s === 'validated' ? s : 'connecting'));
      setErrorMessage(null);

      ws.onopen = () => {
        if (cancelled) {
          closeSocket(ws!);
          return;
        }
        attempts = 0;
        setConnected(true);
        ws!.send(JSON.stringify({ action: 'subscribe', sessionId, accessCode }));
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
            setSnapshot(msg.snapshot);
            setStatus('live');
            break;
          case 'expired':
            setStatus('expired');
            break;
          case 'validated':
            setStatus('validated');
            break;
          case 'access_denied':
            setStatus('access_denied');
            setErrorMessage(msg.message);
            setConnected(false);
            ws?.close();
            break;
          case 'error':
            setStatus('closed');
            setErrorMessage(msg.message);
            setConnected(false);
            break;
          case 'subscribed':
          default:
            break;
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        setStatus((prev) => {
          if (prev === 'expired' || prev === 'validated' || prev === 'closed' || prev === 'access_denied') return prev;
          const delay = Math.min(1000 * 2 ** attempts, 15000);
          attempts += 1;
          reconnectTimer = setTimeout(connect, delay);
          return 'connecting';
        });
      };

      ws.onerror = () => ws?.close();
    };

    setSnapshot(null);
    setStatus('connecting');
    setConnected(false);
    setErrorMessage(null);
    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) closeSocket(ws);
    };
  }, [sessionId, accessCode, mode]);

  return { snapshot, status, connected, errorMessage };
}
