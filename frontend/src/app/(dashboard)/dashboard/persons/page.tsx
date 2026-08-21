'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { Users, Plus, Eye, Edit, Trash2 } from 'lucide-react';
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
import { usePersons, useDeletePerson } from '@/hooks/use-persons';
import { usePagination } from '@/hooks/use-pagination';
import { PersonFormModal } from './person-form-modal';
import { getProvinciaOptions, getDistritoOptions, getCorregimientoOptions, provinciaNombre } from '@/lib/division-politica';
import { isReadOnlyRole } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth.store';

const provinciaOptions = [
  { value: '', label: 'Todas las provincias' },
  ...getProvinciaOptions().filter((o) => o.value !== ''),
];

const artisanOptions = [
  { value: '', label: 'Artesano: todos' },
  { value: 'true', label: 'Con carnet de artesano' },
  { value: 'false', label: 'Sin carnet de artesano' },
];

export default function PersonsPage() {
  const user = useAuthStore((s) => s.user);
  const readOnly = isReadOnlyRole(user?.role);
  const { page, limit, setPage, searchQuery, setSearchQuery } = usePagination();
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [corregimiento, setCorregimiento] = useState('');
  const [hasArtisanCard, setHasArtisanCard] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, isLoading, error } = usePersons({
    page,
    limit,
    search: searchQuery || undefined,
    province: province || undefined,
    district: district || undefined,
    corregimiento: corregimiento || undefined,
    hasArtisanCard: hasArtisanCard === '' ? undefined : hasArtisanCard === 'true',
  });

  const deleteMutation = useDeletePerson();

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setPage(1);
  }, [setSearchQuery, setPage]);

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`¿Estás seguro de eliminar a "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const openCreate = () => {
    setEditId(null);
    setIsModalOpen(true);
  };

  const openEdit = (id: string) => {
    setEditId(id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditId(null);
  };

  const persons = data?.data ?? [];
  const meta = data?.meta;

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

      {/* Filters */}
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <SearchBar
                placeholder="Buscar por nombre, cédula, correo..."
                onSearch={handleSearch}
                initialQuery={searchQuery}
              />
            </div>
            <div className="w-full sm:w-56">
              <Select
                options={provinciaOptions}
                value={province}
                onChange={(e) => {
                  setProvince(e.target.value);
                  setDistrict('');
                  setCorregimiento('');
                  setPage(1);
                }}
                placeholder="Provincia"
              />
            </div>
            <Button variant="outline" onClick={() => setShowAdvanced(!showAdvanced)}>
              Filtros avanzados
            </Button>
          </div>
          {showAdvanced && (
            <div className="grid gap-3 sm:grid-cols-3 border-t pt-4">
              <Select
                options={[{ value: '', label: 'Todos los distritos' }, ...getDistritoOptions(province).filter((o) => o.value)]}
                value={district}
                disabled={!province}
                onChange={(e) => { setDistrict(e.target.value); setCorregimiento(''); setPage(1); }}
              />
              <Select
                options={[{ value: '', label: 'Todos los corregimientos' }, ...getCorregimientoOptions(province, district).filter((o) => o.value)]}
                value={corregimiento}
                disabled={!district}
                onChange={(e) => { setCorregimiento(e.target.value); setPage(1); }}
              />
              <Select
                options={artisanOptions}
                value={hasArtisanCard}
                onChange={(e) => { setHasArtisanCard(e.target.value); setPage(1); }}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0">
        {isLoading ? (
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
            title="No hay personas registradas"
            description={searchQuery ? 'No se encontraron resultados para tu búsqueda.' : 'Comienza registrando un nuevo emprendedor.'}
            action={
              !readOnly && !searchQuery ? (
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
                      <TableCell>
                        {provinciaNombre(item.province) || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {email && <p className="text-xs text-gray-600">{email.contactValue}</p>}
                          {phone && <p className="text-xs text-gray-500">{phone.contactValue}</p>}
                          {!email && !phone && <span className="text-xs text-gray-400">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={item.status === 'ACTIVE' ? 'success' : 'default'}
                        >
                          {item.status === 'ACTIVE' ? 'Activo' : item.status || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell align="right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/dashboard/persons/${item.id}`}>
                            <Button variant="ghost" size="sm" title="Ver detalle">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          {!readOnly && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Editar"
                                onClick={() => openEdit(item.id)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Eliminar"
                                className="text-red-500 hover:text-red-700"
                                onClick={() =>
                                  handleDelete(item.id, `${p?.firstName} ${p?.lastName}`)
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
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

      <PersonFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        editId={editId}
      />
    </div>
  );
}
