'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Plus, Star, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/table';
import { getApiErrorMessage } from '@/services/api-client';
import {
  economicActivitiesService,
  type CinuOption,
} from '@/services/economic-activities.service';

function optionLabel(item: CinuOption): string {
  return `${item.code} — ${item.name}`;
}

interface EntityEconomicActivitiesProps {
  entityId: string;
  readOnly?: boolean;
}

export function EntityEconomicActivitiesPanel({
  entityId,
  readOnly = false,
}: EntityEconomicActivitiesProps) {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [classId, setClassId] = useState('');
  const [subclassId, setSubclassId] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [specificActivity, setSpecificActivity] = useState('');
  const [hasNoticeOfOperation, setHasNoticeOfOperation] = useState('');

  const activities = useQuery({
    queryKey: ['economic-activities', entityId],
    queryFn: () => economicActivitiesService.listByEntity(entityId),
  });

  const categories = useQuery({
    queryKey: ['cinu-categories'],
    queryFn: () => economicActivitiesService.listCategories(),
    enabled: modalOpen,
  });

  const divisions = useQuery({
    queryKey: ['cinu-divisions', categoryId],
    queryFn: () => economicActivitiesService.listDivisions(categoryId),
    enabled: modalOpen && !!categoryId,
  });

  const groups = useQuery({
    queryKey: ['cinu-groups', divisionId],
    queryFn: () => economicActivitiesService.listGroups(divisionId),
    enabled: modalOpen && !!divisionId,
  });

  const classes = useQuery({
    queryKey: ['cinu-classes', groupId],
    queryFn: () => economicActivitiesService.listClasses(groupId),
    enabled: modalOpen && !!groupId,
  });

  const subclasses = useQuery({
    queryKey: ['cinu-subclasses', classId],
    queryFn: () => economicActivitiesService.listSubclasses(classId),
    enabled: modalOpen && !!classId,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['economic-activities', entityId] });
  };

  const assignMutation = useMutation({
    mutationFn: () =>
      economicActivitiesService.assign(entityId, {
        cinuClassId: classId,
        cinuSubclassId: subclassId || null,
        isPrimary,
        specificActivity: specificActivity.trim() || null,
        hasNoticeOfOperation:
          hasNoticeOfOperation === 'true'
            ? true
            : hasNoticeOfOperation === 'false'
              ? false
              : null,
      }),
    onSuccess: () => {
      toast.success('Actividad económica asignada');
      invalidate();
      closeModal();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const primaryMutation = useMutation({
    mutationFn: (activityId: string) =>
      economicActivitiesService.setPrimary(entityId, activityId),
    onSuccess: () => {
      toast.success('Actividad marcada como principal');
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const removeMutation = useMutation({
    mutationFn: (activityId: string) =>
      economicActivitiesService.remove(entityId, activityId),
    onSuccess: () => {
      toast.success('Actividad eliminada');
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const categoryOptions = useMemo(
    () => (categories.data ?? []).map((c) => ({ value: c.id, label: optionLabel(c) })),
    [categories.data]
  );
  const divisionOptions = useMemo(
    () => (divisions.data ?? []).map((c) => ({ value: c.id, label: optionLabel(c) })),
    [divisions.data]
  );
  const groupOptions = useMemo(
    () => (groups.data ?? []).map((c) => ({ value: c.id, label: optionLabel(c) })),
    [groups.data]
  );
  const classOptions = useMemo(
    () => (classes.data ?? []).map((c) => ({ value: c.id, label: optionLabel(c) })),
    [classes.data]
  );
  const subclassOptions = useMemo(
    () => [
      { value: '', label: 'Sin subclase' },
      ...(subclasses.data ?? []).map((c) => ({ value: c.id, label: optionLabel(c) })),
    ],
    [subclasses.data]
  );

  function resetCascadeFrom(level: 'category' | 'division' | 'group' | 'class') {
    if (level === 'category') {
      setDivisionId('');
      setGroupId('');
      setClassId('');
      setSubclassId('');
    } else if (level === 'division') {
      setGroupId('');
      setClassId('');
      setSubclassId('');
    } else if (level === 'group') {
      setClassId('');
      setSubclassId('');
    } else {
      setSubclassId('');
    }
  }

  function closeModal() {
    setModalOpen(false);
    setCategoryId('');
    setDivisionId('');
    setGroupId('');
    setClassId('');
    setSubclassId('');
    setIsPrimary(false);
    setSpecificActivity('');
    setHasNoticeOfOperation('');
  }

  const rows = activities.data ?? [];
  const canSave = !!classId && !assignMutation.isPending;

  return (
    <>
      <div className="mb-4 flex justify-end">
        {!readOnly && (
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>
            Agregar
          </Button>
        )}
      </div>

      <Card
        title="Actividades económicas (CINU 4.1)"
        description="Clasificación oficial de la actividad que realiza la persona o empresa"
      >
        {activities.isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner text="Cargando actividades..." />
          </div>
        ) : activities.isError ? (
          <p className="py-12 text-center text-sm text-red-500">
            No se pudieron cargar las actividades económicas.
          </p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="Sin actividades CINU"
            description="Asigne una o más clases del catálogo CINU 4.1."
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Código</TableHeaderCell>
                <TableHeaderCell>Descripción</TableHeaderCell>
                <TableHeaderCell>Aviso de operación</TableHeaderCell>
                <TableHeaderCell>Principal</TableHeaderCell>
                {!readOnly && <TableHeaderCell align="right">Acciones</TableHeaderCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-sm">
                    {row.subclassCode || row.classCode}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-[#0F172A]">
                      {row.subclassName || row.className}
                    </div>
                    {row.subclassCode ? (
                      <div className="text-xs text-[#64748B]">
                        Clase {row.classCode}: {row.className}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {row.hasNoticeOfOperation === true
                      ? 'Sí'
                      : row.hasNoticeOfOperation === false
                        ? 'No'
                        : '—'}
                  </TableCell>
                  <TableCell>
                    {row.isPrimary ? (
                      <Star className="h-4 w-4 fill-amber-400 text-amber-500" aria-label="Principal" />
                    ) : !readOnly ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Marcar como principal"
                        disabled={primaryMutation.isPending}
                        onClick={() => primaryMutation.mutate(row.id)}
                      >
                        <Star className="h-4 w-4 text-[#94A3B8]" />
                      </Button>
                    ) : (
                      <span className="text-sm text-[#94A3B8]">—</span>
                    )}
                  </TableCell>
                  {!readOnly && (
                    <TableCell align="right">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Eliminar actividad"
                        className="text-red-600 hover:text-red-700"
                        disabled={removeMutation.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `¿Quitar la actividad ${row.subclassCode || row.classCode}?`
                            )
                          ) {
                            removeMutation.mutate(row.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title="Asignar actividad económica"
        size="lg"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              onClick={() => assignMutation.mutate()}
              disabled={!canSave}
              isLoading={assignMutation.isPending}
            >
              Guardar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Categoría"
              placeholder="Seleccionar"
              options={[{ value: '', label: 'Seleccionar' }, ...categoryOptions]}
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                resetCascadeFrom('category');
              }}
            />
            <Select
              label="División"
              placeholder="Seleccionar"
              options={[{ value: '', label: 'Seleccionar' }, ...divisionOptions]}
              value={divisionId}
              disabled={!categoryId}
              onChange={(e) => {
                setDivisionId(e.target.value);
                resetCascadeFrom('division');
              }}
            />
            <Select
              label="Grupo"
              placeholder="Seleccionar"
              options={[{ value: '', label: 'Seleccionar' }, ...groupOptions]}
              value={groupId}
              disabled={!divisionId}
              onChange={(e) => {
                setGroupId(e.target.value);
                resetCascadeFrom('group');
              }}
            />
            <Select
              label="Clase *"
              placeholder="Seleccionar"
              options={[{ value: '', label: 'Seleccionar' }, ...classOptions]}
              value={classId}
              disabled={!groupId}
              onChange={(e) => {
                setClassId(e.target.value);
                resetCascadeFrom('class');
              }}
            />
            <div className="sm:col-span-2">
              <Select
                label="Subclase (opcional)"
                options={subclassOptions}
                value={subclassId}
                disabled={!classId || (subclasses.data?.length ?? 0) === 0}
                onChange={(e) => setSubclassId(e.target.value)}
              />
            </div>
          </div>

          <Input
            label="Actividad Específica"
            placeholder="Ej. venta de frutas"
            maxLength={25}
            value={specificActivity}
            onChange={(e) => setSpecificActivity(e.target.value.slice(0, 25))}
          />
          <p className="text-xs text-[#64748B]">{specificActivity.length}/25 caracteres</p>

          <Select
            label="Aviso de operación"
            options={[
              { value: '', label: 'Seleccionar' },
              { value: 'true', label: 'Sí' },
              { value: 'false', label: 'No' },
            ]}
            value={hasNoticeOfOperation}
            onChange={(e) => setHasNoticeOfOperation(e.target.value)}
          />

          <label className="flex items-center gap-2 text-sm text-[#334155]">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="rounded border-gray-300"
            />
            Marcar como actividad principal
          </label>
        </div>
      </Modal>
    </>
  );
}
