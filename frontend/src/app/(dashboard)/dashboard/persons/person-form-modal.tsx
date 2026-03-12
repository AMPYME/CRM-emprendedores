'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useCreatePerson, useUpdatePerson, usePerson } from '@/hooks/use-persons';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const personSchema = z.object({
  firstName: z.string().min(2, 'El nombre es requerido'),
  lastName: z.string().min(2, 'El apellido es requerido'),
  secondLastName: z.string().optional(),
  cedula: z.string().optional(),
  gender: z.string().optional(),
  birthDate: z.string().optional(),
  nationality: z.string().optional(),
  educationLevel: z.string().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  email: z.string().email('Correo inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
});

type PersonForm = z.infer<typeof personSchema>;

interface PersonFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editId: string | null;
}

const genderOptions = [
  { value: '', label: 'Seleccionar' },
  { value: 'MALE', label: 'Masculino' },
  { value: 'FEMALE', label: 'Femenino' },
  { value: 'OTHER', label: 'Otro' },
];

const educationOptions = [
  { value: '', label: 'Seleccionar' },
  { value: 'Sin estudios', label: 'Sin estudios' },
  { value: 'Primaria', label: 'Primaria' },
  { value: 'Secundaria', label: 'Secundaria' },
  { value: 'Técnico', label: 'Técnico' },
  { value: 'Universitario', label: 'Universitario' },
  { value: 'Postgrado', label: 'Postgrado' },
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

export function PersonFormModal({ isOpen, onClose, editId }: PersonFormModalProps) {
  const isEdit = !!editId;
  const personQuery = usePerson(editId ?? undefined);
  const createMutation = useCreatePerson();
  const updateMutation = useUpdatePerson();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PersonForm>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      secondLastName: '',
      cedula: '',
      gender: '',
      birthDate: '',
      nationality: 'Panameño/a',
      educationLevel: '',
      province: '',
      district: '',
      address: '',
      notes: '',
      email: '',
      phone: '',
    },
  });

  // Populate form on edit
  useEffect(() => {
    if (isEdit && personQuery.data) {
      const p = personQuery.data;
      reset({
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        secondLastName: p.secondLastName || '',
        cedula: p.cedula || '',
        gender: p.gender || '',
        birthDate: p.birthDate?.split('T')[0] || '',
        nationality: '',
        educationLevel: '',
        province: p.entity?.province || '',
        district: p.entity?.district || '',
        address: p.entity?.address || '',
        notes: p.entity?.notes || '',
        email: p.entity?.contacts?.find((c) => c.contactType === 'EMAIL')?.contactValue || '',
        phone: p.entity?.contacts?.find(
          (c) => c.contactType === 'PHONE' || c.contactType === 'MOBILE'
        )?.contactValue || '',
      });
    } else if (!isEdit) {
      reset();
    }
  }, [isEdit, personQuery.data, reset]);

  const onSubmit = async (formData: PersonForm) => {
    const contacts: Array<{ contactType: string; contactValue: string; isPrimary?: boolean }> = [];
    if (formData.email) {
      contacts.push({ contactType: 'EMAIL', contactValue: formData.email, isPrimary: true });
    }
    if (formData.phone) {
      contacts.push({ contactType: 'MOBILE', contactValue: formData.phone });
    }

    const payload = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      secondLastName: formData.secondLastName || undefined,
      cedula: formData.cedula || undefined,
      gender: formData.gender || undefined,
      birthDate: formData.birthDate || undefined,
      nationality: formData.nationality || undefined,
      educationLevel: formData.educationLevel || undefined,
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
    } catch {
      // Error handled by hook toast
    }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Editar persona' : 'Nueva persona'}
      description={isEdit ? 'Actualizar datos del emprendedor' : 'Registrar un nuevo emprendedor'}
      size="lg"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit(onSubmit)} isLoading={isBusy}>
            {isEdit ? 'Guardar cambios' : 'Crear persona'}
          </Button>
        </div>
      }
    >
      {isEdit && personQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner text="Cargando datos..." />
        </div>
      ) : (
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Nombre *" error={errors.firstName?.message} {...register('firstName')} />
          <Input label="Primer apellido *" error={errors.lastName?.message} {...register('lastName')} />
          <Input label="Segundo apellido" {...register('secondLastName')} />
          <Input label="Cédula" placeholder="X-XXXX-XXXXX" {...register('cedula')} />
          <Select label="Género" options={genderOptions} {...register('gender')} />
          <Input label="Fecha de nacimiento" type="date" {...register('birthDate')} />
          <Input label="Nacionalidad" {...register('nationality')} />
          <Select label="Nivel educativo" options={educationOptions} {...register('educationLevel')} />
          <Select label="Provincia" options={provinciaOptions} {...register('province')} />
          <Input label="Distrito" {...register('district')} />
          <Input label="Correo electrónico" type="email" error={errors.email?.message} {...register('email')} className="sm:col-span-2" />
          <Input label="Teléfono / Celular" {...register('phone')} />
          <Input label="Dirección" {...register('address')} />
          <div className="sm:col-span-2">
            <Input label="Notas" {...register('notes')} />
          </div>
        </form>
      )}
    </Modal>
  );
}
