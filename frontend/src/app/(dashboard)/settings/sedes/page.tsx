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
import { adminService, type Sede } from '@/services/admin.service';

export default function SedesPage() {
  const queryClient = useQueryClient();
  const sedes = useQuery({ queryKey: ['sedes'], queryFn: adminService.listSedes });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sede | null>(null);
  const [name, setName] = useState('');

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['sedes'] });

  const save = useMutation({
    mutationFn: () => editing
      ? adminService.updateSede(editing.id, name.trim())
      : adminService.createSede(name.trim()),
    onSuccess: () => {
      toast.success(editing ? 'Sede actualizada' : 'Sede creada');
      refresh();
      setOpen(false);
    },
    onError: () => toast.error('No se pudo guardar la sede'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminService.removeSede(id),
    onSuccess: () => {
      toast.success('Sede eliminada');
      refresh();
    },
    onError: () => toast.error('No se pudo eliminar la sede'),
  });

  const openCreate = () => {
    setEditing(null);
    setName('');
    setOpen(true);
  };

  const openEdit = (sede: Sede) => {
    setEditing(sede);
    setName(sede.name);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sedes"
        description="Catálogo de sedes institucionales"
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nueva sede</Button>}
      />
      <SettingsNav />
      <Card className="p-0">
        {sedes.isLoading ? (
          <div className="flex justify-center py-16"><LoadingSpinner size="lg" text="Cargando sedes..." /></div>
        ) : sedes.isError ? (
          <p className="py-16 text-center text-sm text-red-500">No se pudieron cargar las sedes.</p>
        ) : (sedes.data ?? []).length === 0 ? (
          <EmptyState
            title="No hay sedes"
            description="Cree la primera sede para asignarla a los usuarios."
            action={<Button onClick={openCreate}>Nueva sede</Button>}
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
              {(sedes.data ?? []).map((sede) => (
                <TableRow key={sede.id}>
                  <TableCell>{sede.name}</TableCell>
                  <TableCell align="right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(sede)}>Editar</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => {
                          if (window.confirm(`¿Eliminar la sede "${sede.name}"?`)) remove.mutate(sede.id);
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
        title={editing ? 'Editar sede' : 'Nueva sede'}
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
