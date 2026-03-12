'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, User, Building, Briefcase, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EntityType } from '@/types/entities.types';

/* ──────────────────────────────────────────────── */
/* Types                                            */
/* ──────────────────────────────────────────────── */
export interface EntityOption {
  id: string;
  displayName: string;
  entityType: EntityType;
  subtitle?: string; // e.g. cédula, ruc, etc.
}

interface EntitySearchSelectProps {
  /** Label que se muestra encima del campo */
  label?: string;
  /** Placeholder del input */
  placeholder?: string;
  /** Entidad actualmente seleccionada */
  value?: EntityOption | null;
  /** Callback cuando se selecciona una entidad */
  onSelect: (entity: EntityOption | null) => void;
  /** Filtrar por tipo de entidad */
  entityTypeFilter?: EntityType;
  /** ID de entidad a excluir de resultados (la entidad actual) */
  excludeEntityId?: string;
  /** Error de validación */
  error?: string;
  /** Deshabilitado */
  disabled?: boolean;
}

/* ──────────────────────────────────────────────── */
/* Icon helper                                      */
/* ──────────────────────────────────────────────── */
const entityTypeIcon: Record<EntityType, React.ElementType> = {
  PERSON: User,
  COMPANY: Building,
  ESTABLISHMENT: Briefcase,
};

const entityTypeLabel: Record<EntityType, string> = {
  PERSON: 'Persona',
  COMPANY: 'Empresa',
  ESTABLISHMENT: 'Establecimiento',
};

const entityTypeBg: Record<EntityType, string> = {
  PERSON: 'bg-blue-50 text-blue-600',
  COMPANY: 'bg-emerald-50 text-emerald-600',
  ESTABLISHMENT: 'bg-amber-50 text-amber-600',
};

/* ──────────────────────────────────────────────── */
/* Component                                        */
/* ──────────────────────────────────────────────── */
export function EntitySearchSelect({
  label,
  placeholder = 'Buscar por nombre, cédula, RUC...',
  value,
  onSelect,
  entityTypeFilter,
  excludeEntityId,
  error,
  disabled,
}: EntitySearchSelectProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EntityOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Close on click outside ─────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Debounced search ───────────────────────────
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { entitiesService } = await import('@/services/entities.service');
        const params: Record<string, string> = {
          search: query.trim(),
          limit: '10',
          sortBy: 'displayName',
          sortOrder: 'asc',
        };
        if (entityTypeFilter) {
          params.entityType = entityTypeFilter;
        }
        const res = await entitiesService.list(params as any);
        const mapped: EntityOption[] = res.data
          .filter((e) => e.id !== excludeEntityId)
          .map((e) => {
            let subtitle = '';
            if (e.person?.cedula) subtitle = `Cédula: ${e.person.cedula}`;
            else if (e.company?.ruc) subtitle = `RUC: ${e.company.ruc}`;
            else if (e.establishment?.establishmentName)
              subtitle = e.establishment.establishmentName;
            return {
              id: e.id,
              displayName: e.displayName,
              entityType: e.entityType as EntityType,
              subtitle,
            };
          });
        setResults(mapped);
        setIsOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query, entityTypeFilter, excludeEntityId]);

  // ── Select handler ─────────────────────────────
  const handleSelect = useCallback(
    (entity: EntityOption) => {
      onSelect(entity);
      setQuery('');
      setIsOpen(false);
    },
    [onSelect]
  );

  // ── Clear handler ──────────────────────────────
  const handleClear = useCallback(() => {
    onSelect(null);
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  }, [onSelect]);

  // ── Render selected ────────────────────────────
  if (value) {
    const Icon = entityTypeIcon[value.entityType];
    return (
      <div className="w-full">
        {label && (
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg border px-3 py-2',
            error ? 'border-red-300' : 'border-gray-300',
            disabled ? 'cursor-not-allowed bg-gray-50' : 'bg-white'
          )}
        >
          <div className={cn('rounded-md p-1.5', entityTypeBg[value.entityType])}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              {value.displayName}
            </p>
            <p className="text-xs text-gray-500">
              {entityTypeLabel[value.entityType]}
              {value.subtitle && ` · ${value.subtitle}`}
            </p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  // ── Render search input ────────────────────────
  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'block w-full rounded-lg border bg-white py-2 pl-10 pr-3 text-sm transition-colors',
            'placeholder:text-gray-400',
            'focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
            'disabled:cursor-not-allowed disabled:bg-gray-50',
            error ? 'border-red-300' : 'border-gray-300'
          )}
        />

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {results.length === 0 ? (
              <div className="px-4 py-3 text-center text-sm text-gray-500">
                {query.trim().length < 2
                  ? 'Escribe al menos 2 caracteres...'
                  : 'No se encontraron entidades'}
              </div>
            ) : (
              results.map((entity) => {
                const Icon = entityTypeIcon[entity.entityType];
                return (
                  <button
                    key={entity.id}
                    type="button"
                    onClick={() => handleSelect(entity)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className={cn('rounded-md p-1.5', entityTypeBg[entity.entityType])}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {entity.displayName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {entityTypeLabel[entity.entityType]}
                        {entity.subtitle && ` · ${entity.subtitle}`}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
