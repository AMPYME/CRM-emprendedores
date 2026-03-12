'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { InboxIcon } from 'lucide-react';

interface EmptyStateProps {
  /** Pass JSX like <Icon className="h-8 w-8" /> or a Component reference like {Calendar} */
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  // Handle both JSX elements and component references
  let renderedIcon: React.ReactNode;
  if (!icon) {
    renderedIcon = <InboxIcon className="h-8 w-8" />;
  } else if (typeof icon === 'function') {
    const IconComponent = icon as React.ComponentType<{ className?: string }>;
    renderedIcon = <IconComponent className="h-8 w-8" />;
  } else {
    renderedIcon = icon;
  }

  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      <div className="rounded-xl bg-gray-100 p-4 text-gray-400">
        {renderedIcon}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-gray-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
