'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LocationCascadeFields } from '@/components/forms/location-cascade-fields';
import { useUpdateIntakeSession } from '@/hooks/use-intake';
import type { IntakeSnapshot } from '@/types/intake.types';
import type { IntakeUpdateInput } from '@/services/intake.service';
import {
  DEFAULT_NATIONALITY_CODE,
  nationalitySelectOptions,
} from '@/lib/nationalities';
import { COMPANY_TYPE_OPTIONS } from '@/lib/company-types';
import { COMPANY_SIZE_CLASS_OPTIONS } from '@/lib/company-size-class';
import {
  toProvinciaCode,
  toDistritoCode,
  toCorregimientoCode,
} from '@/lib/division-politica';

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

const companyTypeOptions = COMPANY_TYPE_OPTIONS;

type FormValues = Record<string, string>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  snapshot: IntakeSnapshot;
  accessCode: string;
  onSaved?: () => void;
}

function contactFromSnapshot(s: IntakeSnapshot) {
  const email = s.contacts.find((c) => c.contact_type === 'EMAIL')?.contact_value ?? '';
  const phone =
    s.contacts.find((c) => c.contact_type === 'MOBILE' || c.contact_type === 'PHONE')
      ?.contact_value ?? '';
  return { email, phone };
}

function snapshotToForm(s: IntakeSnapshot): FormValues {
  const { email, phone } = contactFromSnapshot(s);
  const provinceCode = toProvinciaCode(s.location.province);
  const districtCode = toDistritoCode(s.location.province, s.location.district);
  const corregimientoCode = toCorregimientoCode(
    s.location.province,
    s.location.district,
    s.location.corregimiento
  );
  const base = {
    province: provinceCode,
    district: districtCode,
    corregimiento: corregimientoCode,
    address: s.location.address ?? '',
    notes: s.notes ?? '',
    email,
    phone,
  };
  const p = s.person;
  const c = s.company;
  return {
    ...base,
    firstName: p?.first_name ?? '',
    lastName: p?.last_name ?? '',
    secondLastName: p?.second_last_name ?? '',
    cedula: p?.cedula ?? '',
    gender: p?.gender ?? '',
    birthDate: p?.birth_date?.split('T')[0] ?? p?.birth_date ?? '',
    nationalityCode: p?.nationality_code ?? DEFAULT_NATIONALITY_CODE,
    hasArtisanCard:
      p?.has_artisan_card === true ? 'true' : p?.has_artisan_card === false ? 'false' : '',
    legalName: c?.legal_name ?? '',
    tradeName: c?.trade_name ?? '',
    ruc: c?.ruc ?? '',
    dv: c?.dv ?? '',
    companyType: c?.company_type ?? '',
    companySizeClass: c?.company_size_class ?? '',
    foundedDate: c?.founded_date?.split('T')[0] ?? c?.founded_date ?? '',
  };
}

function formToPayload(snapshot: IntakeSnapshot, v: FormValues): IntakeUpdateInput {
  const contacts: IntakeUpdateInput['contacts'] = [];
  if (v.email?.trim()) {
    contacts.push({ contactType: 'EMAIL', contactValue: v.email.trim(), isPrimary: true });
  }
  if (v.phone?.trim()) {
    contacts.push({
      contactType: 'MOBILE',
      contactValue: v.phone.trim(),
      isPrimary: !v.email?.trim(),
    });
  }
  const location = {
    province: v.province || undefined,
    district: v.district || undefined,
    corregimiento: v.corregimiento || undefined,
    address: v.address || undefined,
  };
  const notes = v.notes || undefined;
  const showPerson = !!snapshot.person || snapshot.entityType === 'PERSON';
  const showCompany = !!snapshot.company || snapshot.entityType === 'COMPANY';

  const payload: IntakeUpdateInput = { location, contacts, notes };
  if (showPerson) {
    payload.person = {
      firstName: v.firstName,
      lastName: v.lastName,
      secondLastName: v.secondLastName,
      cedula: v.cedula,
      gender: v.gender,
      birthDate: v.birthDate,
      nationalityCode: v.nationalityCode,
      hasArtisanCard:
        v.hasArtisanCard === 'true' ? true : v.hasArtisanCard === 'false' ? false : undefined,
    };
  }
  if (showCompany || v.legalName?.trim()) {
    payload.company = {
      legalName: v.legalName,
      tradeName: v.tradeName,
      ruc: v.ruc,
      dv: v.dv,
      companyType: v.companyType,
      companySizeClass: v.companySizeClass || undefined,
      foundedDate: v.foundedDate,
    };
  }
  return payload;
}

export function IntakeEditModal({ isOpen, onClose, sessionId, snapshot, accessCode, onSaved }: Props) {
  const updateMutation = useUpdateIntakeSession();
  const { register, handleSubmit, reset, watch, setValue } = useForm<FormValues>();

  useEffect(() => {
    if (isOpen && snapshot) reset(snapshotToForm(snapshot));
  }, [isOpen, snapshot, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      await updateMutation.mutateAsync({
        id: sessionId,
        data: formToPayload(snapshot, values),
        accessCode,
      });
      onSaved?.();
      onClose();
    } catch {
      /* toast en hook */
    }
  };

  const type = snapshot.entityType;
  const showPerson = !!snapshot.person || type === 'PERSON';
  const showCompany = !!snapshot.company || type === 'COMPANY';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Editar sesión"
      description='Los cambios se guardan en borrador, para guardar dar al botón "Validar y Guardar"'
      size="lg"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit(onSubmit)} isLoading={updateMutation.isPending}>
            Guardar cambios
          </Button>
        </div>
      }
    >
      <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
        {showPerson && (
          <>
            <Input label="Nombre *" {...register('firstName', { required: showPerson && !showCompany })} />
            <Input label="Primer apellido" {...register('lastName')} />
            <Input label="Segundo apellido" {...register('secondLastName')} />
            <Input label="Cédula" placeholder="X-XXXX-XXXXX" {...register('cedula')} />
            <Select label="Género" options={genderOptions} {...register('gender')} />
            <Input label="Fecha de nacimiento" type="date" {...register('birthDate')} />
            <Select
              label="Nacionalidad"
              options={nationalitySelectOptions}
              {...register('nationalityCode')}
            />
            <Select label="Carnet de artesano" options={yesNoOptions} {...register('hasArtisanCard')} />
          </>
        )}
        {showCompany && (
          <>
            <Input
              label={showPerson ? 'Empresa / Razón Social' : 'Razón Social *'}
              {...register('legalName', { required: showCompany && !showPerson })}
            />
            <Input label="Nombre comercial" {...register('tradeName')} />
            <Input label="RUC" {...register('ruc')} />
            <Input label="DV" {...register('dv')} />
            <Select label="Tipo de Sociedad" options={companyTypeOptions} {...register('companyType')} />
            <Select
              label="Clasificación por tamaño"
              options={COMPANY_SIZE_CLASS_OPTIONS}
              {...register('companySizeClass')}
            />
            <Input label="Fecha de Inscripción" type="date" {...register('foundedDate')} />
          </>
        )}
        <LocationCascadeFields register={register} watch={watch} setValue={setValue} />
        <Input label="Correo electrónico" type="email" className="sm:col-span-2" {...register('email')} />
        <Input label="Teléfono / Celular" {...register('phone')} />
        <Input label="Dirección" className="sm:col-span-2" {...register('address')} />
        <div className="sm:col-span-2">
          <Input label="Notas" {...register('notes')} />
        </div>
      </form>
    </Modal>
  );
}
