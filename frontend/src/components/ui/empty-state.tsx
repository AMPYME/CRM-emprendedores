'use client';

import React, { createElement, isValidElement } from 'react';
import { cn } from '@/lib/utils';
import { InboxIcon } from 'lucide-react';

interface EmptyStateProps {
  /** JSX (<Icon />) o componente Lucide ({ RadioTower }) */
  icon?: React.ReactNode | React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

function renderEmptyIcon(icon: EmptyStateProps['icon']): React.ReactNode {
  if (!icon) {
    return <InboxIcon className="h-8 w-8" />;
  }
  if (isValidElement(icon)) {
    return icon;
  }
  return createElement(icon as React.ElementType, { className: 'h-8 w-8' });
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  const renderedIcon = renderEmptyIcon(icon);

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
