'use client';

import { cn } from '@/lib/utils';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
}

const variantStyles: Record<string, string> = {
  default: 'bg-gray-100 text-gray-700',
  primary: 'bg-primary-50 text-primary-700',
  success: 'bg-green-50 text-green-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700',
  purple: 'bg-purple-50 text-purple-700',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
};

export function Badge({ children, variant = 'default', size = 'sm', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}

// ── Helpers para mapear estados del backend a badges ─────────

export function EntityStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    ACTIVE: { variant: 'success', label: 'Activo' },
    INACTIVE: { variant: 'danger', label: 'Inactivo' },
    DUPLICATE: { variant: 'warning', label: 'Duplicado' },
    MERGED: { variant: 'info', label: 'Fusionado' },
  };
  const conf = map[status] || { variant: 'default', label: status };
  return <Badge variant={conf.variant}>{conf.label}</Badge>;
}

export function EventStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    DRAFT: { variant: 'default', label: 'Borrador' },
    PUBLISHED: { variant: 'info', label: 'Publicado' },
    IN_PROGRESS: { variant: 'warning', label: 'En curso' },
    COMPLETED: { variant: 'success', label: 'Completado' },
    CANCELLED: { variant: 'danger', label: 'Cancelado' },
  };
  const conf = map[status] || { variant: 'default', label: status };
  return <Badge variant={conf.variant}>{conf.label}</Badge>;
}

export function PortfolioStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    NEW: { variant: 'info', label: 'Nuevo' },
    IN_PROGRESS: { variant: 'warning', label: 'En progreso' },
    WAITING: { variant: 'purple', label: 'En espera' },
    RESOLVED: { variant: 'success', label: 'Resuelto' },
    CLOSED: { variant: 'default', label: 'Cerrado' },
  };
  const conf = map[status] || { variant: 'default', label: status };
  return <Badge variant={conf.variant}>{conf.label}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    LOW: { variant: 'default', label: 'Baja' },
    MEDIUM: { variant: 'info', label: 'Media' },
    HIGH: { variant: 'warning', label: 'Alta' },
    URGENT: { variant: 'danger', label: 'Urgente' },
  };
  const conf = map[priority] || { variant: 'default', label: priority };
  return <Badge variant={conf.variant}>{conf.label}</Badge>;
}
