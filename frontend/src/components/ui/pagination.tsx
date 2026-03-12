'use client';

import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationMeta } from '@/types/api.types';

interface PaginationProps {
  /** Full meta object from API response */
  meta?: PaginationMeta;
  /** Alternative: pass currentPage directly */
  currentPage?: number;
  /** Alternative: pass totalPages directly */
  totalPages?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ meta, currentPage, totalPages, onPageChange, className }: PaginationProps) {
  const page = meta?.page ?? currentPage ?? 1;
  const tp = meta?.totalPages ?? totalPages ?? 1;
  const total = meta?.total;
  const limit = meta?.limit;

  if (tp <= 1) return null;

  const pages = getPageNumbers(page, tp);

  // Show "Mostrando X a Y de Z" only when full meta is available
  const showInfo = total !== undefined && limit !== undefined;
  const start = showInfo ? (page - 1) * limit! + 1 : 0;
  const end = showInfo ? Math.min(page * limit!, total!) : 0;

  return (
    <div className={cn('flex items-center justify-between', className)}>
      {showInfo ? (
        <p className="text-sm text-gray-500">
          Mostrando <span className="font-medium">{start}</span> a{' '}
          <span className="font-medium">{end}</span> de{' '}
          <span className="font-medium">{total}</span> resultados
        </p>
      ) : (
        <div />
      )}
      <nav className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-gray-400">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={cn(
                'min-w-[32px] rounded-lg px-2 py-1 text-sm font-medium',
                p === page
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= tp}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | string)[] = [1];
  if (current > 3) pages.push('...');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push('...');
  pages.push(total);

  return pages;
}
