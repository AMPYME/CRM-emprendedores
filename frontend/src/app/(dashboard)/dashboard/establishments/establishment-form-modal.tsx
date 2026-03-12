'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useCreateEstablishment, useUpdateEstablishment, useEstablishment } from '@/hooks/use-establishments';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const estabSchema = z.object({
  establishmentName: z.string().min(2, 'El nombre es requerido'),
  establishmentType: z.string().optional(),
  economicActivity: z.string().optional(),
  noticeOfOperation: z.string().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  email: z.string().email('Correo inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
});

type EstabForm = z.infer<typeof estabSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editId: string | null;
}

const typeOptions = [
  { value: '', label: 'Seleccionar' },
  { value: 'Local comercial', label: 'Local comercial' },
  { value: 'Oficina', label: 'Oficina' },
  { value: 'Taller', label: 'Taller' },
  { value: 'Restaurante', label: 'Restaurante' },
  { value: 'Kiosco', label: 'Kiosco' },
  { value: 'Otro', label: 'Otro' },
];

const provinciaOptions = [
  { value: '', label: 'Seleccionar' },
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

export function EstablishmentFormModal({ isOpen, onClose, editId }: Props) {
  const isEdit = !!editId;
  const estabQuery = useEstablishment(editId ?? undefined);
  const createMutation = useCreateEstablishment();
  const updateMutation = useUpdateEstablishment();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EstabForm>({
    resolver: zodResolver(estabSchema),
  });

  useEffect(() => {
    if (isEdit && estabQuery.data) {
      const e = estabQuery.data;
      reset({
        establishmentName: e.establishmentName || '',
        establishmentType: e.establishmentType || '',
        economicActivity: e.economicActivity || '',
        noticeOfOperation: e.noticeOfOperation || '',
        province: e.entity?.province || '',
        district: e.entity?.district || '',
        address: e.entity?.address || '',
        notes: e.entity?.notes || '',
        email: e.entity?.contacts?.find((c) => c.contactType === 'EMAIL')?.contactValue || '',
        phone: e.entity?.contacts?.find((c) => c.contactType === 'PHONE' || c.contactType === 'MOBILE')?.contactValue || '',
      });
    } else if (!isEdit) {
      reset({
        establishmentName: '', establishmentType: '', economicActivity: '',
        noticeOfOperation: '', province: '', district: '', address: '',
        notes: '', email: '', phone: '',
      });
    }
  }, [isEdit, estabQuery.data, reset]);

  const onSubmit = async (formData: EstabForm) => {
    const contacts: Array<{ contactType: string; contactValue: string; isPrimary?: boolean }> = [];
    if (formData.email) contacts.push({ contactType: 'EMAIL', contactValue: formData.email, isPrimary: true });
    if (formData.phone) contacts.push({ contactType: 'MOBILE', contactValue: formData.phone });

    const payload = {
      establishmentName: formData.establishmentName,
      establishmentType: formData.establishmentType || undefined,
      economicActivity: formData.economicActivity || undefined,
      noticeOfOperation: formData.noticeOfOperation || undefined,
      province: formData.province || undefined,
      district: formData.district || undefined,
      address: formData.address || undefined,
      notes: formData.notes || undefined,
      contacts: contacts.length > 0 ? contacts : undefined,
    };

    try {
      if (isEdit && editId) {
        await updateMutation.mutateAsync({ id: editId, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onClose();
    } catch { /* toast in hook */ }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      isOpen={isOpen} onClose={onClose}
      title={isEdit ? 'Editar establecimiento' : 'Nuevo establecimiento'}
      description={isEdit ? 'Actualizar datos del establecimiento' : 'Registrar un nuevo establecimiento'}
      size="lg"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit(onSubmit)} isLoading={isBusy}>
            {isEdit ? 'Guardar cambios' : 'Crear establecimiento'}
          </Button>
        </div>
      }
    >
      {isEdit && estabQuery.isLoading ? (
        <div className="flex justify-center py-8"><LoadingSpinner text="Cargando datos..." /></div>
      ) : (
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Nombre *" error={errors.establishmentName?.message} {...register('establishmentName')} />
          <Select label="Tipo" options={typeOptions} {...register('establishmentType')} />
          <Input label="Actividad económica" {...register('economicActivity')} />
          <Input label="Aviso de operación" {...register('noticeOfOperation')} />
          <Select label="Provincia" options={provinciaOptions} {...register('province')} />
          <Input label="Distrito" {...register('district')} />
          <Input label="Correo electrónico" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Teléfono" {...register('phone')} />
          <div className="sm:col-span-2"><Input label="Dirección" {...register('address')} /></div>
          <div className="sm:col-span-2"><Input label="Notas" {...register('notes')} /></div>
        </form>
      )}
    </Modal>
  );
}
