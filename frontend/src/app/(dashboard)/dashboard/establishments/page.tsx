'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { Briefcase, Eye, Edit, Trash2 } from 'lucide-react';
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
  Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell,
} from '@/components/ui/table';
import { useEstablishments, useDeleteEstablishment } from '@/hooks/use-establishments';
import { usePagination } from '@/hooks/use-pagination';
import { EstablishmentFormModal } from './establishment-form-modal';
import { getProvinciaOptions, provinciaNombre } from '@/lib/division-politica';

const provinciaOptions = [
  { value: '', label: 'Todas las provincias' },
  ...getProvinciaOptions().filter((o) => o.value !== ''),
];

export default function EstablishmentsPage() {
  const { page, limit, setPage, searchQuery, setSearchQuery } = usePagination();
  const [province, setProvince] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, isLoading, error } = useEstablishments({
    page, limit, search: searchQuery || undefined, province: province || undefined,
  });

  const deleteMutation = useDeleteEstablishment();

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setPage(1);
  }, [setSearchQuery, setPage]);

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`¿Estás seguro de eliminar "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const openEdit = (id: string) => { setEditId(id); setIsModalOpen(true); };
  const closeModal = () => {
    setIsModalOpen(false);
    setEditId(null);
  };

  const items = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader title="Establecimientos" description="Gestión de establecimientos registrados" />

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <SearchBar placeholder="Buscar por nombre, aviso de operación..." onSearch={handleSearch} initialQuery={searchQuery} />
          </div>
          <div className="w-full sm:w-56">
            <Select options={provinciaOptions} value={province} onChange={(e) => { setProvince(e.target.value); setPage(1); }} />
          </div>
        </div>
      </Card>

      <Card className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" text="Cargando establecimientos..." />
          </div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-500">Error al cargar los establecimientos.</div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No hay establecimientos registrados"
            description={searchQuery ? 'No se encontraron resultados.' : 'Los registros se crean desde el formulario de intake.'}
          />
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nombre</TableHeaderCell>
                  <TableHeaderCell>Tipo</TableHeaderCell>
                  <TableHeaderCell>Actividad</TableHeaderCell>
                  <TableHeaderCell>Provincia</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell align="right">Acciones</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => {
                  const e = item.establishment;
                  return (
                    <TableRow key={item.id}>
                    <TableCell>
                        <p className="font-medium text-gray-900">{e?.establishmentName || item.displayName}</p>
                        {e?.noticeOfOperation && <p className="text-xs text-gray-400">AO: {e.noticeOfOperation}</p>}
                    </TableCell>
                      <TableCell>{e?.establishmentType || '—'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{e?.economicActivity || '—'}</TableCell>
                      <TableCell>{provinciaNombre(item.province) || '—'}</TableCell>
                    <TableCell>
                        <Badge variant={item.status === 'ACTIVE' ? 'success' : 'default'}>
                          {item.status === 'ACTIVE' ? 'Activo' : item.status || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell align="right">
                      <div className="flex items-center justify-end gap-1">
                          <Link href={`/dashboard/establishments/${item.id}`}>
                          <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                        </Link>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(item.id)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="text-red-500 hover:text-red-700"
                            onClick={() => handleDelete(item.id, e?.establishmentName || item.displayName)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
                    Mostrando {(meta.page - 1) * meta.limit + 1} - {Math.min(meta.page * meta.limit, meta.total)} de {meta.total}
                  </p>
                  <Pagination currentPage={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {editId && (
        <EstablishmentFormModal isOpen={isModalOpen} onClose={closeModal} editId={editId} />
      )}
    </div>
  );
}
