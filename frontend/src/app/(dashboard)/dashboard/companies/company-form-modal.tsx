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
import { COMPANY_TYPE_OPTIONS } from '@/lib/company-types';
import { COMPANY_SIZE_CLASS_OPTIONS } from '@/lib/company-size-class';
import { useCreateCompany, useUpdateCompany, useCompany } from '@/hooks/use-companies';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  toProvinciaCode,
  toDistritoCode,
  toCorregimientoCode,
} from '@/lib/division-politica';

const companySchema = z.object({
  legalName: z.string().min(2, 'La razón social es requerida'),
  tradeName: z.string().optional(),
  ruc: z.string().optional(),
  dv: z.string().optional(),
  companyType: z.string().optional(),
  companySizeClass: z.string().optional(),
  foundedDate: z.string().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  corregimiento: z.string().optional(),
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

const companyTypeOptions = COMPANY_TYPE_OPTIONS;

export function CompanyFormModal({ isOpen, onClose, editId }: CompanyFormModalProps) {
  const isEdit = !!editId;
  const companyQuery = useCompany(editId ?? undefined);
  const createMutation = useCreateCompany();
  const updateMutation = useUpdateCompany();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
  });

  useEffect(() => {
    if (isEdit && companyQuery.data) {
      const data = companyQuery.data;
      const c = data.company;
      const provinceCode = toProvinciaCode(data.province);
      const districtCode = toDistritoCode(data.province, data.district);
      const corregimientoCode = toCorregimientoCode(
        data.province,
        data.district,
        data.corregimiento
      );
      reset({
        legalName: c?.legalName || '',
        tradeName: c?.tradeName || '',
        ruc: c?.ruc || '',
        dv: c?.dv || '',
        companyType: c?.companyType || '',
        companySizeClass: c?.companySizeClass || '',
        foundedDate: c?.foundedDate?.split('T')[0] || '',
        province: provinceCode,
        district: districtCode,
        corregimiento: corregimientoCode,
        address: data.address || '',
        notes: data.notes || '',
        email: data.contacts?.find((co) => co.contactType === 'EMAIL')?.contactValue || '',
        phone:
          data.contacts?.find((co) => co.contactType === 'PHONE' || co.contactType === 'MOBILE')
            ?.contactValue || '',
      });
    } else if (!isEdit) {
      reset({
        legalName: '',
        tradeName: '',
        ruc: '',
        dv: '',
        companyType: '',
        companySizeClass: '',
        foundedDate: '',
        province: '',
        district: '',
        corregimiento: '',
        address: '',
        notes: '',
        email: '',
        phone: '',
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
      companySizeClass: formData.companySizeClass || undefined,
      foundedDate: formData.foundedDate || undefined,
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
      /* handled by toast */
    }
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
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit(onSubmit)} isLoading={isBusy}>
            {isEdit ? 'Guardar cambios' : 'Crear empresa'}
          </Button>
        </div>
      }
    >
      {isEdit && companyQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner text="Cargando datos..." />
        </div>
      ) : (
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Razón Social *" error={errors.legalName?.message} {...register('legalName')} />
          <Input label="Nombre comercial" {...register('tradeName')} />
          <Input label="RUC" {...register('ruc')} />
          <Input label="DV" {...register('dv')} className="max-w-[100px]" />
          <Select label="Tipo de Sociedad" options={companyTypeOptions} {...register('companyType')} />
          <Select
            label="Clasificación por tamaño"
            options={COMPANY_SIZE_CLASS_OPTIONS}
            {...register('companySizeClass')}
          />
          <Input label="Fecha de Inscripción" type="date" {...register('foundedDate')} />
          <LocationCascadeFields register={register} watch={watch} setValue={setValue} />
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
