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
import {
  DOCUMENT_TYPE_OPTIONS,
  DocumentTypeValue,
  inferDocumentType,
  validateDocumentNumber,
} from '@/lib/document';

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
  accessCode?: string;
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
  const documentNumber = p?.cedula ?? '';
  return {
    ...base,
    documentType: inferDocumentType(documentNumber) ?? '',
    documentNumber,
    firstName: p?.first_name ?? '',
    lastName: p?.last_name ?? '',
    secondLastName: p?.second_last_name ?? '',
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
      documentType: v.documentType,
      documentNumber: v.documentNumber,
      cedula: v.documentNumber,
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
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
    setError,
  } = useForm<FormValues>();

  useEffect(() => {
    if (isOpen && snapshot) reset(snapshotToForm(snapshot));
  }, [isOpen, snapshot, reset]);

  const documentType = watch('documentType');
  const showPerson = !!snapshot.person || snapshot.entityType === 'PERSON';
  const showCompany = !!snapshot.company || snapshot.entityType === 'COMPANY';

  const onSubmit = async (values: FormValues) => {
    if (showPerson) {
      const docErr = validateDocumentNumber(
        (values.documentType || undefined) as DocumentTypeValue | undefined,
        values.documentNumber,
        { required: true }
      );
      if (docErr) {
        setError(docErr.includes('tipo') ? 'documentType' : 'documentNumber', { message: docErr });
        return;
      }
    }
    if (showCompany) {
      if (!values.tradeName?.trim()) {
        setError('tradeName', { message: 'El nombre comercial es requerido' });
        return;
      }
      if (!values.ruc?.trim()) {
        setError('ruc', { message: 'El RUC es requerido' });
        return;
      }
      if (!values.dv?.trim()) {
        setError('dv', { message: 'El DV es requerido' });
        return;
      }
    }
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
            <Select
              label="Tipo de Documento *"
              options={DOCUMENT_TYPE_OPTIONS}
              error={errors.documentType?.message}
              {...register('documentType', {
                required: 'Seleccione el tipo de documento',
                onChange: () => setValue('documentNumber', ''),
              })}
            />
            <Input
              label="Número de documento *"
              placeholder={
                documentType === 'PASAPORTE'
                  ? 'Solo A-Z y 0-9'
                  : documentType === 'CEDULA_LETRA'
                    ? 'E-8-866-5775'
                    : '8-554-6674'
              }
              error={errors.documentNumber?.message}
              {...register('documentNumber', { required: 'Ingrese el número de documento' })}
            />
            <Input label="Nombre *" {...register('firstName', { required: showPerson && !showCompany })} />
            <Input label="Primer apellido" {...register('lastName')} />
            <Input label="Segundo apellido" {...register('secondLastName')} />
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
            <Input
              label="Nombre comercial *"
              error={errors.tradeName?.message}
              {...register('tradeName', { required: 'El nombre comercial es requerido' })}
            />
            <Input
              label="RUC *"
              error={errors.ruc?.message}
              {...register('ruc', { required: 'El RUC es requerido' })}
            />
            <Input
              label="DV *"
              error={errors.dv?.message}
              {...register('dv', { required: 'El DV es requerido' })}
            />
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
