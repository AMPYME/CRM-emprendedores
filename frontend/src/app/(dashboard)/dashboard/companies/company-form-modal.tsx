'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useCreateCompany, useUpdateCompany, useCompany } from '@/hooks/use-companies';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const companySchema = z.object({
  legalName: z.string().min(2, 'El nombre legal es requerido'),
  tradeName: z.string().optional(),
  ruc: z.string().optional(),
  dv: z.string().optional(),
  companyType: z.string().optional(),
  economicActivity: z.string().optional(),
  foundedDate: z.string().optional(),
  employeeCount: z.string().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  email: z.string().email('Correo inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
});

type CompanyForm = z.infer<typeof companySchema>;

interface CompanyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editId: string | null;
}

const companyTypeOptions = [
  { value: '', label: 'Seleccionar' },
  { value: 'Persona Natural', label: 'Persona Natural' },
  { value: 'Sociedad Anónima', label: 'Sociedad Anónima' },
  { value: 'Sociedad de Responsabilidad Limitada', label: 'S.R.L.' },
  { value: 'Cooperativa', label: 'Cooperativa' },
  { value: 'Fundación', label: 'Fundación' },
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

export function CompanyFormModal({ isOpen, onClose, editId }: CompanyFormModalProps) {
  const isEdit = !!editId;
  const companyQuery = useCompany(editId ?? undefined);
  const createMutation = useCreateCompany();
  const updateMutation = useUpdateCompany();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
  });

  useEffect(() => {
    if (isEdit && companyQuery.data) {
      const data = companyQuery.data;
      const c = data.company;
      reset({
        legalName: c?.legalName || '',
        tradeName: c?.tradeName || '',
        ruc: c?.ruc || '',
        dv: c?.dv || '',
        companyType: c?.companyType || '',
        economicActivity: c?.economicActivity || '',
        province: data.province || '',
        district: data.district || '',
        address: data.address || '',
        notes: data.notes || '',
        email: data.contacts?.find((co) => co.contactType === 'EMAIL')?.contactValue || '',
        phone: data.contacts?.find((co) => co.contactType === 'PHONE' || co.contactType === 'MOBILE')?.contactValue || '',
      });
    } else if (!isEdit) {
      reset({
        legalName: '', tradeName: '', ruc: '', dv: '', companyType: '',
        economicActivity: '', province: '', district: '', address: '',
        notes: '', email: '', phone: '',
      });
    }
  }, [isEdit, companyQuery.data, reset]);

  const onSubmit = async (formData: CompanyForm) => {
    const contacts: Array<{ contactType: string; contactValue: string; isPrimary?: boolean }> = [];
    if (formData.email) contacts.push({ contactType: 'EMAIL', contactValue: formData.email, isPrimary: true });
    if (formData.phone) contacts.push({ contactType: 'MOBILE', contactValue: formData.phone });

    const payload = {
      legalName: formData.legalName,
      tradeName: formData.tradeName || undefined,
      ruc: formData.ruc || undefined,
      dv: formData.dv || undefined,
      companyType: formData.companyType || undefined,
      economicActivity: formData.economicActivity || undefined,
      foundedDate: formData.foundedDate || undefined,
      employeeCount: formData.employeeCount ? parseInt(formData.employeeCount) : undefined,
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
    } catch { /* handled by toast */ }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Editar empresa' : 'Nueva empresa'}
      description={isEdit ? 'Actualizar datos de la empresa' : 'Registrar una nueva empresa'}
      size="lg"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit(onSubmit)} isLoading={isBusy}>
            {isEdit ? 'Guardar cambios' : 'Crear empresa'}
          </Button>
        </div>
      }
    >
      {isEdit && companyQuery.isLoading ? (
        <div className="flex justify-center py-8"><LoadingSpinner text="Cargando datos..." /></div>
      ) : (
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Nombre legal *" error={errors.legalName?.message} {...register('legalName')} />
          <Input label="Nombre comercial" {...register('tradeName')} />
          <Input label="RUC" {...register('ruc')} />
          <Input label="DV" {...register('dv')} className="max-w-[100px]" />
          <Select label="Tipo de empresa" options={companyTypeOptions} {...register('companyType')} />
          <Input label="Actividad económica" {...register('economicActivity')} />
          <Input label="Fecha de fundación" type="date" {...register('foundedDate')} />
          <Input label="# Empleados" type="number" {...register('employeeCount')} />
          <Select label="Provincia" options={provinciaOptions} {...register('province')} />
          <Input label="Distrito" {...register('district')} />
          <Input label="Correo electrónico" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Teléfono" {...register('phone')} />
          <div className="sm:col-span-2">
            <Input label="Dirección" {...register('address')} />
          </div>
          <div className="sm:col-span-2">
            <Input label="Notas" {...register('notes')} />
          </div>
        </form>
      )}
    </Modal>
  );
}
