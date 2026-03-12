'use client';

import { cn } from '@/lib/utils';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

// ── Table wrapper ────────────────────────────────────

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return <thead className="border-b border-gray-200 bg-gray-50/50">{children}</thead>;
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-gray-100">{children}</tbody>;
}

export function TableRow({ children, className, onClick }: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      className={cn(
        'transition-colors',
        onClick && 'cursor-pointer hover:bg-gray-50',
        className
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

// ── Header cell con sorting ────────────────────────

interface TableHeaderCellProps {
  children: React.ReactNode;
  sortKey?: string;
  currentSort?: string;
  currentOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export function TableHeaderCell({
  children, sortKey, currentSort, currentOrder, onSort, className, align = 'left',
}: TableHeaderCellProps) {
  const isSorted = sortKey && currentSort === sortKey;

  const handleClick = () => {
    if (sortKey && onSort) onSort(sortKey);
  };

  return (
    <th
      className={cn(
        'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        sortKey && 'cursor-pointer select-none hover:text-gray-700',
        className
      )}
      onClick={handleClick}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey && (
          isSorted ? (
            currentOrder === 'asc' ? (
              <ArrowUp className="h-3.5 w-3.5 text-primary-600" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5 text-primary-600" />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 text-gray-300" />
          )
        )}
      </span>
    </th>
  );
}

// ── Data cell ────────────────────────────────────────

export function TableCell({ children, className, align = 'left' }: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <td
      className={cn(
        'whitespace-nowrap px-4 py-3 text-gray-700',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        className
      )}
    >
      {children}
    </td>
  );
}
