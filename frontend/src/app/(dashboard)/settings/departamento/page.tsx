'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { SettingsNav } from '@/components/layout/settings-nav';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell,
} from '@/components/ui/table';
import { adminService, type Departamento } from '@/services/admin.service';

export default function DepartamentosPage() {
  const queryClient = useQueryClient();
  const departamentos = useQuery({
    queryKey: ['departamentos'],
    queryFn: adminService.listDepartamentos,
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Departamento | null>(null);
  const [name, setName] = useState('');

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['departamentos'] });

  const save = useMutation({
    mutationFn: () => editing
      ? adminService.updateDepartamento(editing.id, name.trim())
      : adminService.createDepartamento(name.trim()),
    onSuccess: () => {
      toast.success(editing ? 'Departamento actualizado' : 'Departamento creado');
      refresh();
      setOpen(false);
    },
    onError: () => toast.error('No se pudo guardar el departamento'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminService.removeDepartamento(id),
    onSuccess: () => {
      toast.success('Departamento eliminado');
      refresh();
    },
    onError: () => toast.error('No se pudo eliminar el departamento'),
  });

  const openCreate = () => {
    setEditing(null);
    setName('');
    setOpen(true);
  };

  const openEdit = (item: Departamento) => {
    setEditing(item);
    setName(item.name);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departamentos"
        description="Catálogo de departamentos institucionales"
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nuevo departamento</Button>}
      />
      <SettingsNav />
      <Card className="p-0">
        {departamentos.isLoading ? (
          <div className="flex justify-center py-16"><LoadingSpinner size="lg" text="Cargando departamentos..." /></div>
        ) : departamentos.isError ? (
          <p className="py-16 text-center text-sm text-red-500">No se pudieron cargar los departamentos.</p>
        ) : (departamentos.data ?? []).length === 0 ? (
          <EmptyState
            title="No hay departamentos"
            description="Cree el primer departamento para asignarlo a los usuarios."
            action={<Button onClick={openCreate}>Nuevo departamento</Button>}
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Nombre</TableHeaderCell>
                <TableHeaderCell align="right">Acciones</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(departamentos.data ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell align="right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(item)}>Editar</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => {
                          if (window.confirm(`¿Eliminar el departamento "${item.name}"?`)) remove.mutate(item.id);
                        }}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar departamento' : 'Nuevo departamento'}
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} isLoading={save.isPending} disabled={!name.trim()}>
              Guardar
            </Button>
          </div>
        }
      >
        <Input label="Nombre *" value={name} onChange={(e) => setName(e.target.value)} />
      </Modal>
    </div>
  );
}
