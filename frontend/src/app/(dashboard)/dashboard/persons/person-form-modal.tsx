'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LocationCascadeFields } from '@/components/forms/location-cascade-fields';
import { useCreatePerson, useUpdatePerson, usePerson } from '@/hooks/use-persons';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  DEFAULT_NATIONALITY_CODE,
  nationalitySelectOptions,
} from '@/lib/nationalities';
import {
  toProvinciaCode,
  toDistritoCode,
  toCorregimientoCode,
} from '@/lib/division-politica';

const personSchema = z.object({
  firstName: z.string().min(2, 'El nombre es requerido'),
  lastName: z.string().min(2, 'El apellido es requerido'),
  secondLastName: z.string().optional(),
  cedula: z.string().optional(),
  gender: z.string().optional(),
  birthDate: z.string().optional(),
  nationalityCode: z.string().length(3, 'Seleccione la nacionalidad'),
  hasArtisanCard: z.string().optional(),
  seedCapital: z.string().optional(),
  seedCapitalDate: z.string().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  corregimiento: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  email: z.string().email('Correo inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.seedCapital !== '1') return;
  if (!/^(0[1-9]|1[0-2])\/\d{4}$/.test(data.seedCapitalDate ?? '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['seedCapitalDate'],
      message: 'Obligatorio. Use el formato MM/AAAA',
    });
  }
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

const yesNoOptions = [
  { value: '', label: 'Seleccionar' },
  { value: 'true', label: 'Sí' },
  { value: 'false', label: 'No' },
];

const seedCapitalOptions = [
  { value: '', label: 'Seleccionar' },
  { value: '1', label: 'Sí' },
  { value: '0', label: 'No' },
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
    watch,
    setValue,
    formState: { errors },
  } = useForm<PersonForm>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      secondLastName: '',
      cedula: '',
      gender: '',
      birthDate: '',
      nationalityCode: DEFAULT_NATIONALITY_CODE,
      hasArtisanCard: '',
      seedCapital: '',
      seedCapitalDate: '',
      province: '',
      district: '',
      corregimiento: '',
      address: '',
      notes: '',
      email: '',
      phone: '',
    },
  });

  useEffect(() => {
    if (isEdit && personQuery.data) {
      const data = personQuery.data;
      const p = data.person;
      const provinceCode = toProvinciaCode(data.province);
      const districtCode = toDistritoCode(data.province, data.district);
      const corregimientoCode = toCorregimientoCode(
        data.province,
        data.district,
        data.corregimiento
      );
      reset({
        firstName: p?.firstName || '',
        lastName: p?.lastName || '',
        secondLastName: p?.secondLastName || '',
        cedula: p?.cedula || '',
        gender: p?.gender || '',
        birthDate: p?.birthDate?.split('T')[0] || '',
        nationalityCode: p?.nationalityCode || DEFAULT_NATIONALITY_CODE,
        hasArtisanCard:
          p?.hasArtisanCard === true ? 'true' : p?.hasArtisanCard === false ? 'false' : '',
        seedCapital: p?.seedCapital === 1 ? '1' : p?.seedCapital === 0 ? '0' : '',
        seedCapitalDate: p?.seedCapitalDate || '',
        province: provinceCode,
        district: districtCode,
        corregimiento: corregimientoCode,
        address: data.address || '',
        notes: data.notes || '',
        email: data.contacts?.find((c) => c.contactType === 'EMAIL')?.contactValue || '',
        phone:
          data.contacts?.find(
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
      nationalityCode: formData.nationalityCode,
      hasArtisanCard:
        formData.hasArtisanCard === 'true'
          ? true
          : formData.hasArtisanCard === 'false'
            ? false
            : undefined,
      seedCapital: (formData.seedCapital === '1' ? 1 : formData.seedCapital === '0' ? 0 : undefined) as 0 | 1 | undefined,
      seedCapitalDate: formData.seedCapital === '1' ? formData.seedCapitalDate : undefined,
      province: formData.province || undefined,
      district: formData.district || undefined,
      corregimiento: formData.corregimiento || undefined,
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
  const seedCapital = watch('seedCapital');

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
          <Select
            label="Nacionalidad"
            options={nationalitySelectOptions}
            error={errors.nationalityCode?.message}
            {...register('nationalityCode')}
          />
          <Select label="Carnet de artesano" options={yesNoOptions} {...register('hasArtisanCard')} />
          <Select label="Capital semilla" options={seedCapitalOptions} {...register('seedCapital')} />
          {seedCapital === '1' && (
            <Input
              label="Fecha de capital semilla *"
              placeholder="MM/AAAA"
              error={errors.seedCapitalDate?.message}
              {...register('seedCapitalDate')}
            />
          )}
          <LocationCascadeFields register={register} watch={watch} setValue={setValue} />
          <Input
            label="Correo electrónico"
            type="email"
            error={errors.email?.message}
            {...register('email')}
            className="sm:col-span-2"
          />
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
