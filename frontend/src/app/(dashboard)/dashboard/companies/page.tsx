'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building, Plus, Eye, Edit, Trash2 } from 'lucide-react';
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
import { useCompanies, useDeleteCompany } from '@/hooks/use-companies';
import { usePagination } from '@/hooks/use-pagination';
import { CompanyFormModal } from './company-form-modal';

const provinciaOptions = [
  { value: '', label: 'Todas las provincias' },
  { value: 'Bocas del Toro', label: 'Bocas del Toro' },
  { value: 'Coclé', label: 'Coclé' },
  { value: 'Colón', label: 'Colón' },
  { value: 'Chiriquí', label: 'Chiriquí' },
  { value: 'Darién', label: 'Darién' },
  { value: 'Herrera', label: 'Herrera' },
  { value: 'Los Santos', label: 'Los Santos' },
  { value: 'Panamá', label: 'Panamá' },
  { value: 'Panamá Oeste', label: 'Panamá Oeste' },
  { value: 'Veraguas', label: 'Veraguas' },
  { value: 'Guna Yala', label: 'Guna Yala' },
  { value: 'Emberá-Wounaan', label: 'Emberá-Wounaan' },
  { value: 'Ngäbe-Buglé', label: 'Ngäbe-Buglé' },
];

export default function CompaniesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showCreateModal = searchParams.get('action') === 'create';

  const { page, limit, setPage, searchQuery, setSearchQuery } = usePagination();
  const [province, setProvince] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(showCreateModal);

  const { data, isLoading, error } = useCompanies({
    page,
    limit,
    search: searchQuery || undefined,
    province: province || undefined,
  });

  const deleteMutation = useDeleteCompany();

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setPage(1);
  }, [setSearchQuery, setPage]);

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`¿Estás seguro de eliminar "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const openCreate = () => { setEditId(null); setIsModalOpen(true); };
  const openEdit = (id: string) => { setEditId(id); setIsModalOpen(true); };
  const closeModal = () => {
    setIsModalOpen(false);
    setEditId(null);
    if (searchParams.get('action')) router.replace('/dashboard/companies');
  };

  const companies = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresas"
        description="Gestión de empresas registradas"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Nueva empresa
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <SearchBar placeholder="Buscar por nombre, RUC..." onSearch={handleSearch} initialQuery={searchQuery} />
          </div>
          <div className="w-full sm:w-56">
            <Select options={provinciaOptions} value={province} onChange={(e) => { setProvince(e.target.value); setPage(1); }} />
          </div>
        </div>
      </Card>

      <Card className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" text="Cargando empresas..." />
          </div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-500">Error al cargar las empresas.</div>
        ) : companies.length === 0 ? (
          <EmptyState
            icon={Building}
            title="No hay empresas registradas"
            description={searchQuery ? 'No se encontraron resultados.' : 'Comienza registrando una nueva empresa.'}
            action={!searchQuery && <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nueva empresa</Button>}
          />
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Nombre Legal</TableHeaderCell>
                  <TableHeaderCell>RUC</TableHeaderCell>
                  <TableHeaderCell>Tipo</TableHeaderCell>
                  <TableHeaderCell>Provincia</TableHeaderCell>
                  <TableHeaderCell>Estado</TableHeaderCell>
                  <TableHeaderCell align="right">Acciones</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {companies.map((item) => {
                  const c = item.company;
                  return (
                    <TableRow key={item.id}>
                    <TableCell>
                      <div>
                          <p className="font-medium text-gray-900">{c?.legalName}</p>
                          {c?.tradeName && <p className="text-xs text-gray-400">{c.tradeName}</p>}
                      </div>
                    </TableCell>
                      <TableCell><span className="font-mono text-sm">{c?.ruc || '—'}</span></TableCell>
                      <TableCell>{c?.companyType || '—'}</TableCell>
                      <TableCell>{item.province || '—'}</TableCell>
                    <TableCell>
                        <Badge variant={item.status === 'ACTIVE' ? 'success' : 'default'}>
                          {item.status === 'ACTIVE' ? 'Activo' : item.status || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell align="right">
                      <div className="flex items-center justify-end gap-1">
                          <Link href={`/dashboard/companies/${item.id}`}>
                          <Button variant="ghost" size="sm" title="Ver detalle"><Eye className="h-4 w-4" /></Button>
                        </Link>
                          <Button variant="ghost" size="sm" title="Editar" onClick={() => openEdit(item.id)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="sm" title="Eliminar" className="text-red-500 hover:text-red-700"
                            onClick={() => handleDelete(item.id, c?.legalName || item.displayName)}
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

      <CompanyFormModal isOpen={isModalOpen} onClose={closeModal} editId={editId} />
    </div>
  );
}
