'use client';

import { cn } from '@/lib/utils';

interface ImportProgressBarProps {
  percent: number;
  label?: string;
  className?: string;
}

/** Barra de progreso para procesos de importación (.xlsx). */
export function ImportProgressBar({
  percent,
  label,
  className,
}: ImportProgressBarProps) {
  const safe = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div className={cn('w-full max-w-lg mx-auto text-left', className)}>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <p className="truncate text-gray-600">{label || 'Procesando…'}</p>
        <span className="shrink-0 font-semibold tabular-nums text-primary-700">{safe}%</span>
      </div>
      <div
        className="h-3 overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progreso de importación'}
      >
        <div
          className="h-full rounded-full bg-primary-600 transition-[width] duration-500 ease-out"
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
}
