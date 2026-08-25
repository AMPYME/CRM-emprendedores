'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getIntakeWsUrl } from '@/services/intake.service';
import type { IntakeWsEvent } from '@/types/intake.types';

function closeSocket(ws: WebSocket): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.close();
    return;
  }
  if (ws.readyState === WebSocket.CONNECTING) {
    ws.onopen = () => ws.close();
  }
}

/**
 * Cola de verificación en vivo: el operador se suscribe al WebSocket de intake
 * (`subscribe_queue`) y React Query se invalida cuando llegan ítems, se
 * liberan asignaciones o expira el TTL de 30 min (IMPORT, no FIELD).
 */
export function useVerificationQueueStream(enabled = true): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const connect = () => {
      if (cancelled) return;
      try {
        ws = new WebSocket(getIntakeWsUrl());
      } catch {
        return;
      }

      ws.onopen = () => {
        if (cancelled) {
          closeSocket(ws!);
          return;
        }
        attempts = 0;
        ws!.send(JSON.stringify({ action: 'subscribe_queue' }));
      };

      ws.onmessage = (ev) => {
        let msg: IntakeWsEvent;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.type === 'queue_changed') {
          qc.invalidateQueries({ queryKey: ['verifications'] });
          qc.invalidateQueries({ queryKey: ['intake-sessions'] });
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        const delay = Math.min(1000 * 2 ** attempts, 15000);
        attempts += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => ws?.close();
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) closeSocket(ws);
    };
  }, [enabled, qc]);
}
