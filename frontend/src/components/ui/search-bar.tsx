'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  /** Controlled value */
  value?: string;
  /** Controlled change handler */
  onChange?: (value: string) => void;
  /** Alternative: callback-based search (debounced) */
  onSearch?: (value: string) => void;
  /** Alternative: initial query for uncontrolled mode */
  initialQuery?: string;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  onSearch,
  initialQuery,
  placeholder = 'Buscar...',
  debounceMs = 400,
  className,
}: SearchBarProps) {
  const controlledValue = value ?? initialQuery ?? '';
  const [localValue, setLocalValue] = useState(controlledValue);

  // Sync from controlled prop
  useEffect(() => {
    setLocalValue(value ?? initialQuery ?? '');
  }, [value, initialQuery]);

  // Debounced emit
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== controlledValue) {
        if (onChange) onChange(localValue);
        if (onSearch) onSearch(localValue);
      }
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [localValue, debounceMs, onChange, onSearch, controlledValue]);

  const handleClear = useCallback(() => {
    setLocalValue('');
    if (onChange) onChange('');
    if (onSearch) onSearch('');
  }, [onChange, onSearch]);

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-9 text-sm placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
