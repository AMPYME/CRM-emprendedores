'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_NATIONALITY_CODE,
  nationalitySelectOptions,
} from '@/lib/nationalities';
import { COMPANY_TYPE_OPTIONS } from '@/lib/company-types';
import { COMPANY_SIZE_CLASS_OPTIONS } from '@/lib/company-size-class';
import {
  getCorregimientoOptions,
  getDistritoOptions,
  getProvinciaOptions,
} from '@/lib/division-politica';
import { intakeAccessCodeKey } from '@/services/intake.service';
import {
  PublicIntakeError,
  publicIntakeService,
} from '@/services/public-intake.service';
import type { IntakeUpdateInput } from '@/services/intake.service';
import { useIntakeStream } from '@/hooks/use-intake-stream';
import type { IntakeEntityType, IntakeSnapshot } from '@/types/intake.types';

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

const introCopy: Record<IntakeEntityType, { title: string; text: string }> = {
  PERSON: {
    title: 'Registro de persona',
    text: 'Completa tus datos personales. Se guardan automáticamente mientras escribes.',
  },
  COMPANY: {
    title: 'Registro de empresa',
    text: 'Completa los datos de la empresa. Se guardan automáticamente mientras escribes.',
  },
};

type View = 'loading' | 'code' | 'form' | 'done' | 'gate';
type SaveState = '' | 'saving' | 'saved' | 'error';

interface FormState {
  firstName: string;
  lastName: string;
  secondLastName: string;
  cedula: string;
  gender: string;
  birthDate: string;
  nationalityCode: string;
  hasArtisanCard: string;
  legalName: string;
  tradeName: string;
  ruc: string;
  dv: string;
  companyType: string;
  companySizeClass: string;
  foundedDate: string;
  province: string;
  district: string;
  corregimiento: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
}

const emptyForm = (): FormState => ({
  firstName: '',
  lastName: '',
  secondLastName: '',
  cedula: '',
  gender: '',
  birthDate: '',
  nationalityCode: DEFAULT_NATIONALITY_CODE,
  hasArtisanCard: '',
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
  email: '',
  phone: '',
  address: '',
  notes: '',
});

function snapshotToForm(snapshot: IntakeSnapshot | null): FormState {
  const next = emptyForm();
  if (!snapshot) return next;
  const p = snapshot.person;
  if (p) {
    next.firstName = p.first_name ?? '';
    next.lastName = p.last_name ?? '';
    next.secondLastName = p.second_last_name ?? '';
    next.cedula = p.cedula ?? '';
    next.gender = p.gender ?? '';
    next.birthDate = p.birth_date?.split('T')[0] ?? '';
    next.nationalityCode = p.nationality_code || DEFAULT_NATIONALITY_CODE;
    next.hasArtisanCard =
      p.has_artisan_card === true ? 'true' : p.has_artisan_card === false ? 'false' : '';
  }
  const c = snapshot.company;
  if (c) {
    next.legalName = c.legal_name ?? '';
    next.tradeName = c.trade_name ?? '';
    next.ruc = c.ruc ?? '';
    next.dv = c.dv ?? '';
    next.companyType = c.company_type ?? '';
    next.companySizeClass = c.company_size_class ?? '';
    next.foundedDate = c.founded_date?.split('T')[0] ?? '';
  }
  next.province = snapshot.location.province ?? '';
  next.district = snapshot.location.district ?? '';
  next.corregimiento = snapshot.location.corregimiento ?? '';
  next.address = snapshot.location.address ?? '';
  next.notes = snapshot.notes ?? '';
  next.email = snapshot.contacts.find((ct) => ct.contact_type === 'EMAIL')?.contact_value ?? '';
  next.phone =
    snapshot.contacts.find((ct) => ct.contact_type === 'MOBILE' || ct.contact_type === 'PHONE')
      ?.contact_value ?? '';
  return next;
}

function collectPayload(entityType: IntakeEntityType, form: FormState): IntakeUpdateInput {
  const contacts: IntakeUpdateInput['contacts'] = [];
  if (form.email.trim()) {
    contacts.push({ contactType: 'EMAIL', contactValue: form.email.trim(), isPrimary: true });
  }
  if (form.phone.trim()) {
    contacts.push({
      contactType: 'MOBILE',
      contactValue: form.phone.trim(),
      isPrimary: !form.email.trim(),
    });
  }
  const location = {
    province: form.province,
    district: form.district,
    corregimiento: form.corregimiento,
    address: form.address,
  };
  if (entityType === 'PERSON') {
    return {
      person: {
        firstName: form.firstName,
        lastName: form.lastName,
        secondLastName: form.secondLastName,
        cedula: form.cedula,
        gender: form.gender,
        birthDate: form.birthDate,
        nationalityCode: form.nationalityCode,
        hasArtisanCard:
          form.hasArtisanCard === 'true'
            ? true
            : form.hasArtisanCard === 'false'
              ? false
              : undefined,
      },
      location,
      contacts,
      notes: form.notes,
    };
  }
  return {
    company: {
      legalName: form.legalName,
      tradeName: form.tradeName,
      ruc: form.ruc,
      dv: form.dv,
      companyType: form.companyType,
      companySizeClass: form.companySizeClass || undefined,
      foundedDate: form.foundedDate,
    },
    location,
    contacts,
    notes: form.notes,
  };
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function PublicIntakeForm() {
  const searchParams = useSearchParams();
  const sid = searchParams.get('sid')?.trim() || '';

  const [view, setView] = useState<View>(sid ? 'loading' : 'gate');
  const [gateTitle, setGateTitle] = useState('Enlace no válido');
  const [gateMsg, setGateMsg] = useState(
    'Falta el identificador de sesión. Solicita un enlace de registro.'
  );
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [entityType, setEntityType] = useState<IntakeEntityType>('PERSON');
  const [ttlMinutes, setTtlMinutes] = useState(20);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saveState, setSaveState] = useState<SaveState>('');
  const [saveText, setSaveText] = useState('Cargando…');
  const [submitHint, setSubmitHint] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [invalid, setInvalid] = useState<Record<string, boolean>>({});

  const formRef = useRef(form);
  const entityTypeRef = useRef(entityType);
  const accessCodeRef = useRef(accessCode);
  const inFlight = useRef(false);
  const pendingSave = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  formRef.current = form;
  entityTypeRef.current = entityType;
  accessCodeRef.current = accessCode;

  const stream = useIntakeStream(
    view === 'form' ? sid : undefined,
    view === 'form' ? accessCode : undefined,
    'public'
  );

  const showGate = useCallback((title: string, msg: string) => {
    setGateTitle(title);
    setGateMsg(msg);
    setView('gate');
    setSaveState('error');
    setSaveText('No disponible');
  }, []);

  const applySession = useCallback(
    (session: { entityType: IntakeEntityType; status: string; ttlMinutes: number }, snapshot: IntakeSnapshot) => {
      if (session.status === 'SUBMITTED' || session.status === 'VALIDATED') {
        setView('done');
        setSaveState('saved');
        setSaveText('Enviado');
        return;
      }
      setEntityType(session.entityType);
      setTtlMinutes(session.ttlMinutes);
      setForm(snapshotToForm(snapshot));
      setView('form');
      setSaveState('saved');
      setSaveText('Listo para empezar');
    },
    []
  );

  const loadSession = useCallback(
    async (nextCode: string) => {
      setSaveState('saving');
      setSaveText('Validando enlace…');
      try {
        const data = await publicIntakeService.getSession(sid, nextCode);
        setAccessCode(nextCode);
        sessionStorage.setItem(intakeAccessCodeKey(sid), nextCode);
        applySession(data.session, data.snapshot);
      } catch (err) {
        sessionStorage.removeItem(intakeAccessCodeKey(sid));
        setAccessCode('');
        if (err instanceof PublicIntakeError && err.status === 401) {
          setView('code');
          setCodeError('El código temporal no es válido. Verifica e intenta de nuevo.');
          setSaveText('Ingresa el código');
          return;
        }
        if (err instanceof PublicIntakeError && err.status === 410) {
          showGate('Sesión expirada', 'El enlace caducó por inactividad. Solicita uno nuevo.');
          return;
        }
        if (err instanceof PublicIntakeError && err.status === 404) {
          showGate('Enlace no válido', 'La sesión no existe. Solicita un enlace de registro.');
          return;
        }
        setView('code');
        setCodeError('No se pudo validar el código. Intenta de nuevo.');
      }
    },
    [applySession, showGate, sid]
  );

  useEffect(() => {
    if (!sid) {
      showGate('Enlace no válido', 'Falta el identificador de sesión. Solicita un enlace de registro.');
      return;
    }
    const stored = sessionStorage.getItem(intakeAccessCodeKey(sid)) || '';
    if (stored) {
      void loadSession(stored);
    } else {
      setView('code');
      setSaveText('Ingresa el código');
    }
  }, [loadSession, showGate, sid]);

  useEffect(() => {
    if (view !== 'form') return;
    if (stream.status === 'expired') {
      showGate('Sesión expirada', 'El enlace caducó por inactividad. Solicita uno nuevo.');
    } else if (stream.status === 'validated') {
      setView('done');
      setSaveState('saved');
      setSaveText('Enviado');
    }
  }, [showGate, stream.status, view]);

  const save = useCallback(async () => {
    const currentCode = accessCodeRef.current;
    if (!sid || !currentCode || inFlight.current) {
      if (inFlight.current) pendingSave.current = true;
      return;
    }
    inFlight.current = true;
    setSaveState('saving');
    setSaveText('Guardando…');
    try {
      await publicIntakeService.save(
        sid,
        currentCode,
        collectPayload(entityTypeRef.current, formRef.current)
      );
      setSaveState('saved');
      setSaveText('Guardado automáticamente');
    } catch (err) {
      if (err instanceof PublicIntakeError && err.status === 401) {
        sessionStorage.removeItem(intakeAccessCodeKey(sid));
        setAccessCode('');
        setView('code');
        setCodeError('El código temporal no es válido. Solicita uno nuevo al operador.');
        return;
      }
      if (err instanceof PublicIntakeError && err.status === 410) {
        showGate('Sesión expirada', 'El enlace caducó por inactividad. Solicita uno nuevo.');
        return;
      }
      setSaveState('error');
      setSaveText('Error al guardar. Reintentando…');
      saveTimer.current = setTimeout(() => {
        void save();
      }, 4000);
    } finally {
      inFlight.current = false;
      if (pendingSave.current) {
        pendingSave.current = false;
        void save();
      }
    }
  }, [showGate, sid]);

  const queueSave = useCallback(
    (delay = 500) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void save();
      }, delay);
    },
    [save]
  );

  const updateField = useCallback(
    (key: keyof FormState, value: string, immediate = false) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        if (key === 'province') {
          next.district = '';
          next.corregimiento = '';
        } else if (key === 'district') {
          next.corregimiento = '';
        }
        return next;
      });
      setInvalid((prev) => ({ ...prev, [key]: false }));
      if (immediate) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        void save();
      } else {
        queueSave();
      }
    },
    [queueSave, save]
  );

  const provinciaOptions = useMemo(() => getProvinciaOptions(), []);
  const distritoOptions = useMemo(() => getDistritoOptions(form.province), [form.province]);
  const corregimientoOptions = useMemo(
    () => getCorregimientoOptions(form.province, form.district),
    [form.province, form.district]
  );

  async function onCodeSubmit(e: FormEvent) {
    e.preventDefault();
    const next = code.replace(/\D/g, '').slice(0, 6);
    if (next.length !== 6) {
      setCodeError('Ingresa un código de 6 dígitos.');
      return;
    }
    setCodeError('');
    await loadSession(next);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const nextInvalid: Record<string, boolean> = {};
    if (entityType === 'PERSON') {
      if (!form.firstName.trim()) nextInvalid.firstName = true;
      if (!form.lastName.trim()) nextInvalid.lastName = true;
    } else if (!form.legalName.trim()) {
      nextInvalid.legalName = true;
    }
    if (form.email.trim() && !isValidEmail(form.email.trim())) nextInvalid.email = true;
    setInvalid(nextInvalid);
    if (Object.keys(nextInvalid).length) {
      setSubmitHint('Completa los campos obligatorios (*) y revisa el correo.');
      return;
    }
    setSubmitHint('');
    setSubmitting(true);
    setSaveState('saving');
    setSaveText('Enviando…');
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      pendingSave.current = false;
      while (inFlight.current) {
        await new Promise((r) => setTimeout(r, 50));
      }
      await save();
      await publicIntakeService.submit(sid, accessCodeRef.current);
      setView('done');
      setSaveState('saved');
      setSaveText('Enviado');
    } catch {
      setSubmitHint('No se pudo enviar. Intenta de nuevo.');
      setSubmitting(false);
    }
  }

  const intro = introCopy[entityType];
  const nationalityOptions = [{ value: '', label: 'Seleccionar' }, ...nationalitySelectOptions];

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[920px] items-center justify-between px-5 py-3.5">
          <span className="text-sm font-extrabold tracking-wide">AMPYME</span>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                saveState === 'saving'
                  ? 'bg-amber-500'
                  : saveState === 'saved'
                    ? 'bg-green-600'
                    : saveState === 'error'
                      ? 'bg-red-600'
                      : 'bg-gray-400'
              }`}
            />
            <span>{saveText}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[920px] px-5 pb-20 pt-7">
        {view === 'loading' && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">Validando enlace…</p>
          </div>
        )}

        {view === 'gate' && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold text-gray-900">{gateTitle}</h1>
            <p className="mt-2 text-gray-500">{gateMsg}</p>
          </div>
        )}

        {view === 'code' && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold text-gray-900">Código de acceso</h1>
            <p className="mt-2 max-w-xl text-gray-500">
              Ingresa el código temporal de 6 dígitos que te proporcionó el operador de AMPYME.
            </p>
            <form className="mt-6 max-w-xs space-y-4" onSubmit={onCodeSubmit} autoComplete="off">
              <Input
                label="Código temporal"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                autoComplete="one-time-code"
                value={code}
                error={codeError || undefined}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setCodeError('');
                }}
              />
              <Button type="submit">Continuar</Button>
            </form>
          </div>
        )}

        {view === 'form' && (
          <>
            <div className="mb-6">
              <h1 className="text-[26px] font-semibold text-gray-900">{intro.title}</h1>
              <p className="mt-1 max-w-xl text-gray-500">
                {intro.text} El enlace expira tras <strong>{ttlMinutes}</strong> minutos de
                inactividad.
              </p>
            </div>

            <form className="space-y-5" onSubmit={onSubmit} autoComplete="off" noValidate>
              {entityType === 'PERSON' && (
                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-base font-bold">Datos personales</h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      label="Nombre"
                      required
                      value={form.firstName}
                      error={invalid.firstName ? 'Requerido' : undefined}
                      onChange={(e) => updateField('firstName', e.target.value)}
                    />
                    <Input
                      label="Primer apellido"
                      required
                      value={form.lastName}
                      error={invalid.lastName ? 'Requerido' : undefined}
                      onChange={(e) => updateField('lastName', e.target.value)}
                    />
                    <Input
                      label="Segundo apellido"
                      value={form.secondLastName}
                      onChange={(e) => updateField('secondLastName', e.target.value)}
                    />
                    <Input
                      label="Cédula"
                      placeholder="X-XXXX-XXXXX"
                      value={form.cedula}
                      onChange={(e) => updateField('cedula', e.target.value)}
                    />
                    <Select
                      label="Género"
                      options={genderOptions}
                      value={form.gender}
                      onChange={(e) => updateField('gender', e.target.value, true)}
                    />
                    <Input
                      label="Fecha de nacimiento"
                      type="date"
                      value={form.birthDate}
                      onChange={(e) => updateField('birthDate', e.target.value, true)}
                    />
                    <Select
                      label="Nacionalidad"
                      options={nationalityOptions}
                      value={form.nationalityCode}
                      onChange={(e) => updateField('nationalityCode', e.target.value, true)}
                    />
                    <Select
                      label="Carnet de artesano"
                      options={yesNoOptions}
                      value={form.hasArtisanCard}
                      onChange={(e) => updateField('hasArtisanCard', e.target.value, true)}
                    />
                  </div>
                </section>
              )}

              {entityType === 'COMPANY' && (
                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-base font-bold">Datos de la empresa</h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      label="Razón Social"
                      required
                      value={form.legalName}
                      error={invalid.legalName ? 'Requerido' : undefined}
                      onChange={(e) => updateField('legalName', e.target.value)}
                    />
                    <Input
                      label="Nombre comercial"
                      value={form.tradeName}
                      onChange={(e) => updateField('tradeName', e.target.value)}
                    />
                    <Input
                      label="RUC"
                      value={form.ruc}
                      onChange={(e) => updateField('ruc', e.target.value)}
                    />
                    <Input
                      label="DV"
                      value={form.dv}
                      className="max-w-[100px]"
                      onChange={(e) => updateField('dv', e.target.value)}
                    />
                    <Select
                      label="Tipo de Sociedad"
                      options={COMPANY_TYPE_OPTIONS}
                      value={form.companyType}
                      onChange={(e) => updateField('companyType', e.target.value, true)}
                    />
                    <Select
                      label="Clasificación por tamaño"
                      options={COMPANY_SIZE_CLASS_OPTIONS}
                      value={form.companySizeClass}
                      onChange={(e) => updateField('companySizeClass', e.target.value, true)}
                    />
                    <Input
                      label="Fecha de Inscripción"
                      type="date"
                      value={form.foundedDate}
                      onChange={(e) => updateField('foundedDate', e.target.value, true)}
                    />
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-base font-bold">Ubicación y contacto</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Select
                    label="Provincia"
                    options={provinciaOptions}
                    value={form.province}
                    onChange={(e) => updateField('province', e.target.value, true)}
                  />
                  <Select
                    label="Distrito"
                    options={distritoOptions}
                    value={form.district}
                    disabled={!form.province}
                    onChange={(e) => updateField('district', e.target.value, true)}
                  />
                  <Select
                    label="Corregimiento"
                    options={corregimientoOptions}
                    value={form.corregimiento}
                    disabled={!form.district}
                    onChange={(e) => updateField('corregimiento', e.target.value, true)}
                  />
                  <Input
                    label="Correo electrónico"
                    type="email"
                    className="sm:col-span-2"
                    placeholder="correo@ejemplo.com"
                    value={form.email}
                    error={invalid.email ? 'Correo inválido' : undefined}
                    onChange={(e) => updateField('email', e.target.value)}
                  />
                  <Input
                    label="Teléfono / Celular"
                    placeholder="6000-0000"
                    value={form.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                  />
                  <Input
                    label="Dirección"
                    className="sm:col-span-2"
                    value={form.address}
                    onChange={(e) => updateField('address', e.target.value)}
                  />
                  <Input
                    label="Notas"
                    className="sm:col-span-2"
                    value={form.notes}
                    onChange={(e) => updateField('notes', e.target.value)}
                  />
                </div>
              </section>

              <div>
                <Button type="submit" disabled={submitting} isLoading={submitting}>
                  Enviar registro
                </Button>
                {submitHint && <p className="mt-2 text-sm text-red-600">{submitHint}</p>}
              </div>
            </form>
          </>
        )}

        {view === 'done' && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-3xl text-green-600">
              ✓
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">¡Registro enviado!</h1>
            <p className="mt-2 text-gray-500">
              Tus datos fueron recibidos y están siendo revisados por el equipo de AMPYME.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
