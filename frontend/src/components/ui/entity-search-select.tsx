'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
  useMemo,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  X,
  User,
  Building,
  Loader2,
  ChevronDown,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EntityType } from '@/types/entities.types';
import { entitiesService } from '@/services/entities.service';

/* ──────────────────────────────────────────────── */
/* Types                                            */
/* ──────────────────────────────────────────────── */
export interface EntityOption {
  id: string;
  displayName: string;
  entityType: EntityType;
  subtitle?: string;
}

interface EntitySearchSelectProps {
  label?: string;
  placeholder?: string;
  value?: EntityOption | null;
  onSelect: (entity: EntityOption | null) => void;
  /** Un solo tipo fijo */
  entityTypeFilter?: EntityType;
  /** Tipos permitidos (chips + filtro). Si no se pasa, todos. */
  allowedEntityTypes?: EntityType[];
  excludeEntityId?: string;
  /** IDs adicionales a excluir (p. ej. ya relacionadas) */
  excludeEntityIds?: string[];
  error?: string;
  disabled?: boolean;
}

/* ──────────────────────────────────────────────── */
/* Helpers                                          */
/* ──────────────────────────────────────────────── */
const entityTypeIcon: Record<EntityType, React.ElementType> = {
  PERSON: User,
  COMPANY: Building,
};

const entityTypeLabel: Record<EntityType, string> = {
  PERSON: 'Persona',
  COMPANY: 'Empresa',
};

const entityTypeBg: Record<EntityType, string> = {
  PERSON: 'bg-blue-50 text-blue-600',
  COMPANY: 'bg-emerald-50 text-emerald-600',
};

const ALL_TYPES: EntityType[] = ['PERSON', 'COMPANY'];

function mapEntity(e: {
  id: string;
  displayName: string;
  entityType: string;
  person?: { cedula: string | null } | null;
  company?: { ruc: string | null } | null;
}): EntityOption {
  let subtitle = '';
  if (e.person?.cedula) subtitle = `Cédula: ${e.person.cedula}`;
  else if (e.company?.ruc) subtitle = `RUC: ${e.company.ruc}`;

  return {
    id: e.id,
    displayName: e.displayName,
    entityType: e.entityType as EntityType,
    subtitle,
  };
}

/* ──────────────────────────────────────────────── */
/* Component — combobox / searchable dropdown       */
/* ──────────────────────────────────────────────── */
export function EntitySearchSelect({
  label,
  placeholder = 'Seleccionar o buscar entidad...',
  value,
  onSelect,
  entityTypeFilter,
  allowedEntityTypes,
  excludeEntityId,
  excludeEntityIds,
  error,
  disabled,
}: EntitySearchSelectProps) {
  const allowed = allowedEntityTypes?.length
    ? allowedEntityTypes
    : entityTypeFilter
      ? [entityTypeFilter]
      : ALL_TYPES;

  const excludedKey = useMemo(() => {
    const ids = [
      ...(excludeEntityId ? [excludeEntityId] : []),
      ...(excludeEntityIds ?? []),
    ];
    return [...new Set(ids)].sort().join('|');
  }, [excludeEntityId, excludeEntityIds]);

  const isExcluded = useCallback(
    (id: string) => {
      if (!excludedKey) return false;
      return excludedKey.split('|').includes(id);
    },
    [excludedKey]
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [typeChip, setTypeChip] = useState<EntityType | 'ALL'>(
    entityTypeFilter ?? (allowed.length === 1 ? allowed[0] : 'ALL')
  );
  const [results, setResults] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fetchId = useRef(0);

  const activeTypeFilter: EntityType | undefined =
    typeChip === 'ALL' ? entityTypeFilter : typeChip;

  const positionMenu = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 280 && rect.top > spaceBelow;
    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: Math.max(rect.width, 280),
      zIndex: 80,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4, maxHeight: Math.min(320, rect.top - 12) }
        : { top: rect.bottom + 4, maxHeight: Math.min(320, spaceBelow - 12) }),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    positionMenu();
    const onScroll = () => positionMenu();
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, positionMenu]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: globalThis.MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const loadEntities = useCallback(
    async (search: string) => {
      const id = ++fetchId.current;
      setLoading(true);
      try {
        const res = await entitiesService.list({
          search: search.trim() || undefined,
          limit: 40,
          page: 1,
          sortBy: 'displayName',
          sortOrder: 'asc',
          status: 'ACTIVE',
          ...(activeTypeFilter ? { entityType: activeTypeFilter } : {}),
        });
        if (id !== fetchId.current) return;

        const mapped = res.data
          .filter((e) => !isExcluded(e.id))
          .filter((e) => allowed.includes(e.entityType as EntityType))
          .map(mapEntity);

        setResults(mapped);
        setHighlight(0);
      } catch {
        if (id === fetchId.current) setResults([]);
      } finally {
        if (id === fetchId.current) setLoading(false);
      }
    },
    [activeTypeFilter, allowed, isExcluded]
  );

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      void loadEntities(query);
    }, query.trim() ? 250 : 0);
    return () => clearTimeout(timer);
  }, [open, query, loadEntities]);

  const openMenu = () => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
  };

  const handleSelect = (entity: EntityOption) => {
    onSelect(entity);
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e: ReactMouseEvent) => {
    e.stopPropagation();
    onSelect(null);
    setQuery('');
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(results.length - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const pick = results[highlight];
      if (pick) handleSelect(pick);
    }
  };

  const showTypeChips = allowed.length > 1 && !entityTypeFilter;

  const menu = open
    ? createPortal(
        <div
          ref={listRef}
          style={menuStyle}
          className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl"
          role="listbox"
        >
          <div className="border-b border-gray-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Escribe para filtrar..."
                className="w-full rounded-md border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:bg-white focus:ring-1 focus:ring-primary-500"
              />
              {loading && (
                <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
              )}
            </div>
            {showTypeChips && (
              <div className="mt-2 flex flex-wrap gap-1">
                <TypeChip
                  active={typeChip === 'ALL'}
                  onClick={() => setTypeChip('ALL')}
                  label="Todos"
                />
                {allowed.map((t) => (
                  <TypeChip
                    key={t}
                    active={typeChip === t}
                    onClick={() => setTypeChip(t)}
                    label={entityTypeLabel[t]}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100% - 56px)' }}>
            {results.length === 0 && !loading ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                {query.trim()
                  ? 'No se encontraron entidades'
                  : 'No hay entidades disponibles'}
              </div>
            ) : (
              results.map((entity, idx) => {
                const Icon = entityTypeIcon[entity.entityType];
                const selected = value?.id === entity.id;
                return (
                  <button
                    key={entity.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => handleSelect(entity)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      idx === highlight ? 'bg-primary-50' : 'hover:bg-gray-50',
                      selected && 'bg-primary-50/70'
                    )}
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
                        {entity.subtitle ? ` · ${entity.subtitle}` : ''}
                      </p>
                    </div>
                    {selected && <Check className="h-4 w-4 shrink-0 text-primary-600" />}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="w-full" ref={rootRef}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      )}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm transition-colors',
          'focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
          'disabled:cursor-not-allowed disabled:bg-gray-50',
          error ? 'border-red-300' : 'border-gray-300',
          open && 'border-primary-500 ring-1 ring-primary-500'
        )}
      >
        {value ? (
          <>
            <div className={cn('rounded-md p-1', entityTypeBg[value.entityType])}>
              {(() => {
                const Icon = entityTypeIcon[value.entityType];
                return <Icon className="h-3.5 w-3.5" />;
              })()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-gray-900">{value.displayName}</p>
              <p className="truncate text-xs text-gray-500">
                {entityTypeLabel[value.entityType]}
                {value.subtitle ? ` · ${value.subtitle}` : ''}
              </p>
            </div>
            {!disabled && (
              <span
                role="button"
                tabIndex={-1}
                onClick={handleClear}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Quitar selección"
              >
                <X className="h-4 w-4" />
              </span>
            )}
          </>
        ) : (
          <>
            <Search className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="flex-1 truncate text-gray-400">{placeholder}</span>
          </>
        )}
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')}
        />
      </button>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {menu}
    </div>
  );
}

function TypeChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
        active
          ? 'bg-primary-600 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      )}
    >
      {label}
    </button>
  );
}
