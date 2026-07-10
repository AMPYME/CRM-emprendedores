'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { IntakeSnapshot } from '@/types/intake.types';
import { nationalityLabel } from '@/lib/nationalities';
import {
  provinciaNombre,
  distritoNombre,
  corregimientoNombre,
} from '@/lib/division-politica';

const genderOptions = [
  { value: 'MALE', label: 'Masculino' },
  { value: 'FEMALE', label: 'Femenino' },
  { value: 'OTHER', label: 'Otro' },
];

const companyTypeOptions = [
  { value: 'Persona Natural', label: 'Persona Natural' },
  { value: 'Sociedad Anónima', label: 'Sociedad Anónima' },
  { value: 'Sociedad de Responsabilidad Limitada', label: 'S.R.L.' },
  { value: 'Cooperativa', label: 'Cooperativa' },
  { value: 'Fundación', label: 'Fundación' },
  { value: 'Otro', label: 'Otro' },
];

const establishmentTypeOptions = [
  { value: 'Local comercial', label: 'Local comercial' },
  { value: 'Oficina', label: 'Oficina' },
  { value: 'Taller', label: 'Taller' },
  { value: 'Restaurante', label: 'Restaurante' },
  { value: 'Kiosco', label: 'Kiosco' },
  { value: 'Otro', label: 'Otro' },
];

type FormValues = Record<string, string>;

function optionLabel(options: Array<{ value: string; label: string }>, value: string): string {
  if (!value) return '';
  return options.find((o) => o.value === value)?.label ?? value;
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
  const base = {
    province: provinciaNombre(s.location.province),
    district: distritoNombre(s.location.province, s.location.district),
    corregimiento: corregimientoNombre(
      s.location.province,
      s.location.district,
      s.location.corregimiento
    ),
    address: s.location.address ?? '',
    notes: s.notes ?? '',
    email,
    phone,
  };

  if (s.entityType === 'PERSON') {
    const p = s.person;
    return {
      ...base,
      firstName: p?.first_name ?? '',
      lastName: p?.last_name ?? '',
      secondLastName: p?.second_last_name ?? '',
      cedula: p?.cedula ?? '',
      gender: p?.gender ?? '',
      birthDate: p?.birth_date?.split('T')[0] ?? p?.birth_date ?? '',
      nationalityCode: p?.nationality_code ?? '',
    };
  }

  if (s.entityType === 'COMPANY') {
    const c = s.company;
    return {
      ...base,
      legalName: c?.legal_name ?? '',
      tradeName: c?.trade_name ?? '',
      ruc: c?.ruc ?? '',
      dv: c?.dv ?? '',
      companyType: c?.company_type ?? '',
      economicActivity: c?.economic_activity ?? '',
      foundedDate: c?.founded_date?.split('T')[0] ?? c?.founded_date ?? '',
      employeeCount: c?.employee_count != null ? String(c.employee_count) : '',
    };
  }

  const e = s.establishment;
  return {
    ...base,
    establishmentName: e?.establishment_name ?? '',
    establishmentType: e?.establishment_type ?? '',
    economicActivity: e?.economic_activity ?? '',
    noticeOfOperation: e?.notice_of_operation ?? '',
  };
}

function ReadOnlyField({
  label,
  value,
  className,
}: {
  label: string;
  value?: string;
  className?: string;
}) {
  return (
    <Input
      label={label}
      value={value ?? ''}
      readOnly
      tabIndex={-1}
      className={cn('cursor-default bg-gray-50 text-gray-900', className)}
    />
  );
}

function PersonFields({ v }: { v: FormValues }) {
  return (
    <>
      <ReadOnlyField label="Nombre *" value={v.firstName} />
      <ReadOnlyField label="Primer apellido *" value={v.lastName} />
      <ReadOnlyField label="Segundo apellido" value={v.secondLastName} />
      <ReadOnlyField label="Cédula" value={v.cedula} />
      <ReadOnlyField label="Género" value={optionLabel(genderOptions, v.gender)} />
      <ReadOnlyField label="Fecha de nacimiento" value={v.birthDate} />
      <ReadOnlyField label="Nacionalidad" value={nationalityLabel(v.nationalityCode)} />
      <ReadOnlyField label="Provincia" value={v.province} />
      <ReadOnlyField label="Distrito" value={v.district} />
      <ReadOnlyField label="Corregimiento" value={v.corregimiento} />
      <ReadOnlyField label="Correo electrónico" value={v.email} className="sm:col-span-2" />
      <ReadOnlyField label="Teléfono / Celular" value={v.phone} />
      <ReadOnlyField label="Dirección" value={v.address} />
      <div className="sm:col-span-2">
        <ReadOnlyField label="Notas" value={v.notes} />
      </div>
    </>
  );
}

function CompanyFields({ v }: { v: FormValues }) {
  return (
    <>
      <ReadOnlyField label="Nombre legal *" value={v.legalName} />
      <ReadOnlyField label="Nombre comercial" value={v.tradeName} />
      <ReadOnlyField label="RUC" value={v.ruc} />
      <ReadOnlyField label="DV" value={v.dv} className="max-w-[100px]" />
      <ReadOnlyField label="Tipo de empresa" value={optionLabel(companyTypeOptions, v.companyType)} />
      <ReadOnlyField label="Actividad económica" value={v.economicActivity} />
      <ReadOnlyField label="Fecha de fundación" value={v.foundedDate} />
      <ReadOnlyField label="# Empleados" value={v.employeeCount} />
      <ReadOnlyField label="Provincia" value={v.province} />
      <ReadOnlyField label="Distrito" value={v.district} />
      <ReadOnlyField label="Corregimiento" value={v.corregimiento} />
      <ReadOnlyField label="Correo electrónico" value={v.email} />
      <ReadOnlyField label="Teléfono" value={v.phone} />
      <div className="sm:col-span-2">
        <ReadOnlyField label="Dirección" value={v.address} />
      </div>
      <div className="sm:col-span-2">
        <ReadOnlyField label="Notas" value={v.notes} />
      </div>
    </>
  );
}

function EstablishmentFields({ v }: { v: FormValues }) {
  return (
    <>
      <ReadOnlyField label="Nombre *" value={v.establishmentName} />
      <ReadOnlyField label="Tipo" value={optionLabel(establishmentTypeOptions, v.establishmentType)} />
      <ReadOnlyField label="Actividad económica" value={v.economicActivity} />
      <ReadOnlyField label="Aviso de operación" value={v.noticeOfOperation} />
      <ReadOnlyField label="Provincia" value={v.province} />
      <ReadOnlyField label="Distrito" value={v.district} />
      <ReadOnlyField label="Corregimiento" value={v.corregimiento} />
      <ReadOnlyField label="Correo electrónico" value={v.email} />
      <ReadOnlyField label="Teléfono" value={v.phone} />
      <div className="sm:col-span-2">
        <ReadOnlyField label="Dirección" value={v.address} />
      </div>
      <div className="sm:col-span-2">
        <ReadOnlyField label="Notas" value={v.notes} />
      </div>
    </>
  );
}

const titles: Record<IntakeSnapshot['entityType'], { title: string; description: string }> = {
  PERSON: {
    title: 'Registro de persona',
    description: 'Datos capturados en tiempo real desde el formulario del emprendedor.',
  },
  COMPANY: {
    title: 'Registro de empresa',
    description: 'Datos capturados en tiempo real desde el formulario del emprendedor.',
  },
  ESTABLISHMENT: {
    title: 'Registro de establecimiento',
    description: 'Datos capturados en tiempo real desde el formulario del emprendedor.',
  },
};

export function IntakeSnapshotView({ snapshot }: { snapshot: IntakeSnapshot }) {
  const values = snapshotToForm(snapshot);
  const meta = titles[snapshot.entityType];

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h3 className="text-base font-semibold text-gray-900">{meta.title}</h3>
        <p className="mt-1 text-sm text-gray-500">{meta.description}</p>
      </div>
      <div className="px-6 py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {snapshot.entityType === 'PERSON' && <PersonFields v={values} />}
          {snapshot.entityType === 'COMPANY' && <CompanyFields v={values} />}
          {snapshot.entityType === 'ESTABLISHMENT' && <EstablishmentFields v={values} />}
        </div>
      </div>
    </div>
  );
}
