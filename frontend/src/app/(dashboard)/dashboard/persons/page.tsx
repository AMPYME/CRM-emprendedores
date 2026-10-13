'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, Users, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SearchBar } from '@/components/ui/search-bar';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '@/components/ui/table';
import { usePersons } from '@/hooks/use-persons';
import { PersonFormModal } from './person-form-modal';
import {
  getProvinciaOptions,
  getDistritoOptions,
  getCorregimientoOptions,
  provinciaNombre,
} from '@/lib/division-politica';
import { isReadOnlyRole } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth.store';
import { personChangesService } from '@/services/person-changes.service';
import { economicActivitiesService } from '@/services/economic-activities.service';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/services/api-client';

const LIMIT = 20;

const provinciaOptions = [
  { value: '', label: 'Todas las provincias' },
  ...getProvinciaOptions().filter((o) => o.value !== ''),
];

const artisanOptions = [
  { value: '', label: 'Artesano: todos' },
  { value: 'true', label: 'Con carnet de artesano' },
  { value: 'false', label: 'Sin carnet de artesano' },
];

type DraftFilters = {
  search: string;
  province: string;
  district: string;
  corregimiento: string;
  hasArtisanCard: string;
  cinuCategoryId: string;
  cinuDivisionId: string;
};

function readDraft(sp: URLSearchParams): DraftFilters {
  return {
    search: sp.get('q') || '',
    province: sp.get('province') || '',
    district: sp.get('district') || '',
    corregimiento: sp.get('corregimiento') || '',
    hasArtisanCard: sp.get('artisan') || '',
    cinuCategoryId: sp.get('cinuCategoryId') || '',
    cinuDivisionId: sp.get('cinuDivisionId') || '',
  };
}

function hasAdvancedFilters(d: DraftFilters): boolean {
  return Boolean(
    d.province ||
      d.district ||
      d.corregimiento ||
      d.hasArtisanCard ||
      d.cinuCategoryId ||
      d.cinuDivisionId
  );
}

function buildSearchParams(draft: DraftFilters, page: number): URLSearchParams {
  const p = new URLSearchParams();
  p.set('run', '1');
  if (page > 1) p.set('page', String(page));
  if (draft.search.trim()) p.set('q', draft.search.trim());
  if (draft.province) p.set('province', draft.province);
  if (draft.district) p.set('district', draft.district);
  if (draft.corregimiento) p.set('corregimiento', draft.corregimiento);
  if (draft.hasArtisanCard) p.set('artisan', draft.hasArtisanCard);
  if (draft.cinuCategoryId) p.set('cinuCategoryId', draft.cinuCategoryId);
  if (draft.cinuDivisionId) p.set('cinuDivisionId', draft.cinuDivisionId);
  return p;
}

function optionLabel(code: string, name: string) {
  return `${code} — ${name}`;
}

export default function PersonsPage() {
  const user = useAuthStore((s) => s.user);
  const readOnly = isReadOnlyRole(user?.role);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const applied = useMemo(() => readDraft(searchParams), [searchParams]);
  const hasSearched = searchParams.get('run') === '1';
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);

  const [draft, setDraft] = useState<DraftFilters>(() => readDraft(searchParams));
  const [showAdvanced, setShowAdvanced] = useState(() => hasAdvancedFilters(readDraft(searchParams)));
  const [editId, setEditId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const replaceFilters = useCallback(
    (nextDraft: DraftFilters, nextPage: number) => {
      const qs = buildSearchParams(nextDraft, nextPage).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router]
  );

  const handleSearch = () => {
    replaceFilters(draft, 1);
  };

  const setPage = (nextPage: number) => {
    replaceFilters(applied, nextPage);
  };

  const categoriesQuery = useQuery({
    queryKey: ['cinu-categories'],
    queryFn: () => economicActivitiesService.listCategories(),
  });

  const divisionsQuery = useQuery({
    queryKey: ['cinu-divisions', draft.cinuCategoryId],
    queryFn: () => economicActivitiesService.listDivisions(draft.cinuCategoryId),
    enabled: Boolean(draft.cinuCategoryId),
  });

  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'Categoría: todas' },
      ...(categoriesQuery.data ?? []).map((c) => ({
        value: c.id,
        label: optionLabel(c.code, c.name),
      })),
    ],
    [categoriesQuery.data]
  );

  const divisionOptions = useMemo(
    () => [
      { value: '', label: 'División: todas' },
      ...(divisionsQuery.data ?? []).map((c) => ({
        value: c.id,
        label: optionLabel(c.code, c.name),
      })),
    ],
    [divisionsQuery.data]
  );

  const { data, isLoading, error, isFetching } = usePersons(
    {
      page,
      limit: LIMIT,
      search: applied.search || undefined,
      province: applied.province || undefined,
      district: applied.district || undefined,
      corregimiento: applied.corregimiento || undefined,
      hasArtisanCard:
        applied.hasArtisanCard === '' ? undefined : applied.hasArtisanCard === 'true',
      cinuCategoryId: applied.cinuCategoryId || undefined,
      cinuDivisionId: applied.cinuDivisionId || undefined,
    },
    { enabled: hasSearched }
  );

  const openCreate = () => {
    setEditId(null);
    setIsModalOpen(true);
  };

  const openEdit = async (id: string) => {
    try {
      const pending = await personChangesService.hasPending(id);
      if (pending) {
        toast.error(
          'Esta persona tiene cambios pendientes de confirmación. Confírmelos o cancele antes de editar.'
        );
        return;
      }
      setEditId(id);
      setIsModalOpen(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err) || 'No se pudo verificar pendientes');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditId(null);
  };

  const persons = data?.data ?? [];
  const meta = data?.meta;
  const showLoading = hasSearched && (isLoading || isFetching);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personas"
        description="Gestión de emprendedores registrados"
        actions={
          !readOnly ? (
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Nueva persona
            </Button>
          ) : undefined
        }
      />

      <Card>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <SearchBar
                placeholder="Buscar por nombre, cédula, correo..."
                value={draft.search}
                onChange={(q) => setDraft((prev) => ({ ...prev, search: q }))}
                debounceMs={0}
              />
            </div>
            <Button type="submit" icon={<Search className="h-4 w-4" />}>
              Buscar
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowAdvanced(!showAdvanced)}>
              Filtros avanzados
            </Button>
          </div>
          {showAdvanced && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 border-t pt-4">
              <Select
                options={provinciaOptions}
                value={draft.province}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    province: e.target.value,
                    district: '',
                    corregimiento: '',
                  }))
                }
                placeholder="Provincia"
              />
              <Select
                options={[
                  { value: '', label: 'Todos los distritos' },
                  ...getDistritoOptions(draft.province).filter((o) => o.value),
                ]}
                value={draft.district}
                disabled={!draft.province}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    district: e.target.value,
                    corregimiento: '',
                  }))
                }
              />
              <Select
                options={[
                  { value: '', label: 'Todos los corregimientos' },
                  ...getCorregimientoOptions(draft.province, draft.district).filter((o) => o.value),
                ]}
                value={draft.corregimiento}
                disabled={!draft.district}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, corregimiento: e.target.value }))
                }
              />
              <Select
                options={artisanOptions}
                value={draft.hasArtisanCard}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, hasArtisanCard: e.target.value }))
                }
              />
              <Select
                options={categoryOptions}
                value={draft.cinuCategoryId}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    cinuCategoryId: e.target.value,
                    cinuDivisionId: '',
                  }))
                }
              />
              <Select
                options={divisionOptions}
                value={draft.cinuDivisionId}
                disabled={!draft.cinuCategoryId}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, cinuDivisionId: e.target.value }))
                }
              />
            </div>
          )}
        </form>
      </Card>

      <Card className="p-0">
        {!hasSearched ? (
          <EmptyState
            icon={Search}
            title="Buscar personas"
            description="Configure los filtros y pulse Buscar para ver resultados."
          />
        ) : showLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" text="Cargando personas..." />
          </div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-500">
            Error al cargar las personas. Intenta nuevamente.
          </div>
        ) : persons.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No se encontraron personas"
            description="No hay resultados para los filtros aplicados."
            action={
              !readOnly ? (
                <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                  Nueva persona
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nombre</TableHeaderCell>
                  <TableHeaderCell>Cédula</TableHeaderCell>
                  <TableHeaderCell>Provincia</TableHeaderCell>
                  <TableHeaderCell>Contacto</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell align="right">Acciones</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {persons.map((item) => {
                  const p = item.person;
                  const email = item.contacts?.find((c) => c.contactType === 'EMAIL');
                  const phone = item.contacts?.find(
                    (c) => c.contactType === 'PHONE' || c.contactType === 'MOBILE'
                  );
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-gray-900">
                            {p?.firstName} {p?.lastName}
                            {p?.secondLastName ? ` ${p.secondLastName}` : ''}
                          </p>
                          {item.displayName !== `${p?.firstName} ${p?.lastName}` && (
                            <p className="text-xs text-gray-400">{item.displayName}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{p?.cedula || '—'}</span>
                      </TableCell>
                      <TableCell>{provinciaNombre(item.province) || '—'}</TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {email && <p className="text-xs text-gray-600">{email.contactValue}</p>}
                          {phone && <p className="text-xs text-gray-500">{phone.contactValue}</p>}
                          {!email && !phone && <span className="text-xs text-gray-400">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'ACTIVE' ? 'success' : 'default'}>
                          {item.status === 'ACTIVE' ? 'Activo' : item.status || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell align="right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/dashboard/persons/${item.id}`}>
                            <Button variant="ghost" size="sm">
                              Ver
                            </Button>
                          </Link>
                          {!readOnly && (
                            <Button variant="ghost" size="sm" onClick={() => openEdit(item.id)}>
                              Editar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {meta && meta.totalPages > 1 && (
              <div className="border-t p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Mostrando {(meta.page - 1) * meta.limit + 1} -{' '}
                    {Math.min(meta.page * meta.limit, meta.total)} de {meta.total}
                  </p>
                  <Pagination
                    currentPage={meta.page}
                    totalPages={meta.totalPages}
                    onPageChange={setPage}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <PersonFormModal isOpen={isModalOpen} onClose={closeModal} editId={editId} />
    </div>
  );
}
