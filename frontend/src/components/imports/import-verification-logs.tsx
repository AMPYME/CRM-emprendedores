'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { ImportVerificationLogEntry } from '@/types/imports.types';

interface ImportVerificationLogsProps {
  logs: ImportVerificationLogEntry[];
  className?: string;
}

const typeLabel: Record<string, string> = {
  PERSON: 'Persona',
  COMPANY: 'Empresa',
  BOTH: 'Persona + empresa',
};

/**
 * Ventana de logs de filas enviadas a la cola de verificación / intake.
 */
export function ImportVerificationLogs({ logs, className }: ImportVerificationLogsProps) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-gray-200 bg-slate-950 text-left shadow-inner',
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          Logs de envío a intake
        </p>
        <span className="text-[11px] tabular-nums text-slate-500">
          {logs.length} registro{logs.length === 1 ? '' : 's'}
        </span>
      </div>
      <div
        ref={scroller}
        className="max-h-72 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-5 text-slate-200"
      >
        {logs.length === 0 ? (
          <p className="text-slate-500">Esperando filas…</p>
        ) : (
          logs.map((log, i) => (
            <div key={`${log.at}-${log.rowNumber}-${i}`} className="border-b border-slate-800/80 py-1 last:border-0">
              <span className="text-slate-500">
                {new Date(log.at).toLocaleTimeString('es-PA', { hour12: false })}
              </span>
              {' '}
              <span className="text-amber-300">fila {log.rowNumber}</span>
              {' · '}
              <span className="text-sky-300">{typeLabel[log.entityType] || log.entityType}</span>
              {' · '}
              <span className="text-white">{log.name}</span>
              {(log.cedula || log.ruc) && (
                <span className="text-slate-400">
                  {' '}
                  ({[log.cedula, log.ruc].filter(Boolean).join(' / ')})
                </span>
              )}
              {' — '}
              <span className="text-emerald-300">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
