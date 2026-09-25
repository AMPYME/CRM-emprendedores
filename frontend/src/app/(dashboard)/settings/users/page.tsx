'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/layout/page-header';
import { SettingsNav } from '@/components/layout/settings-nav';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell,
} from '@/components/ui/table';
import { adminService, type CrmUser } from '@/services/admin.service';
import { roleLabel } from '@/lib/roles';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ['admin-users'], queryFn: adminService.listUsers });
  const sedes = useQuery({ queryKey: ['sedes'], queryFn: adminService.listSedes });
  const departamentos = useQuery({ queryKey: ['departamentos'], queryFn: adminService.listDepartamentos });
  const [editing, setEditing] = useState<CrmUser | null>(null);
  const [sedeId, setSedeId] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');

  const save = useMutation({
    mutationFn: () => adminService.updateUserAssignment(editing!.id, {
      sedeId: sedeId || null,
      departamentoId: departamentoId || null,
    }),
    onSuccess: () => {
      toast.success('Usuario actualizado');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditing(null);
    },
    onError: () => toast.error('No se pudo actualizar el usuario'),
  });

  const openEdit = (user: CrmUser) => {
    setEditing(user);
    setSedeId(user.sede?.id ?? '');
    setDepartamentoId(user.departamento?.id ?? '');
  };

  const sedeOptions = [
    { value: '', label: 'Sin sede' },
    ...(sedes.data ?? []).map((sede) => ({ value: sede.id, label: sede.name })),
  ];
  const departamentoOptions = [
    { value: '', label: 'Sin departamento' },
    ...(departamentos.data ?? []).map((item) => ({ value: item.id, label: item.name })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Asigne la sede y el departamento de cada usuario"
      />
      <SettingsNav />
      <Card className="p-0">
        {users.isLoading ? (
          <div className="flex justify-center py-16"><LoadingSpinner size="lg" text="Cargando usuarios..." /></div>
        ) : users.isError ? (
          <p className="py-16 text-center text-sm text-red-500">No se pudieron cargar los usuarios.</p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Nombre</TableHeaderCell>
                <TableHeaderCell>Correo</TableHeaderCell>
                <TableHeaderCell>Rol</TableHeaderCell>
                <TableHeaderCell>Sede</TableHeaderCell>
                <TableHeaderCell>Departamento</TableHeaderCell>
                <TableHeaderCell align="right">Editar</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(users.data ?? []).map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.firstName} {user.lastName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{roleLabel(user.role)}</TableCell>
                  <TableCell>{user.sede?.name ?? '—'}</TableCell>
                  <TableCell>{user.departamento?.name ?? '—'}</TableCell>
                  <TableCell align="right">
                    <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title="Sede y departamento"
        description={editing ? `${editing.firstName} ${editing.lastName}` : undefined}
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} isLoading={save.isPending}>Guardar</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            label="Sede"
            options={sedeOptions}
            value={sedeId}
            onChange={(e) => setSedeId(e.target.value)}
          />
          <Select
            label="Departamento"
            options={departamentoOptions}
            value={departamentoId}
            onChange={(e) => setDepartamentoId(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
