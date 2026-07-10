'use client';

import { useMemo } from 'react';
import {
  FieldValues,
  Path,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from 'react-hook-form';
import { Select } from '@/components/ui/select';
import {
  getCorregimientoOptions,
  getDistritoOptions,
  getProvinciaOptions,
} from '@/lib/division-politica';

interface Props<T extends FieldValues> {
  register: UseFormRegister<T>;
  watch: UseFormWatch<T>;
  setValue: UseFormSetValue<T>;
}

/** Valores del form = códigos; options.label = nombre. */
export function LocationCascadeFields<T extends FieldValues>({
  register,
  watch,
  setValue,
}: Props<T>) {
  const province = (watch('province' as Path<T>) as string) || '';
  const district = (watch('district' as Path<T>) as string) || '';

  const provinciaOptions = useMemo(() => getProvinciaOptions(), []);
  const distritoOptions = useMemo(() => getDistritoOptions(province), [province]);
  const corregimientoOptions = useMemo(
    () => getCorregimientoOptions(province, district),
    [province, district]
  );

  return (
    <>
      <Select
        label="Provincia"
        options={provinciaOptions}
        {...register('province' as Path<T>, {
          onChange: () => {
            setValue('district' as Path<T>, '' as T[Path<T>]);
            setValue('corregimiento' as Path<T>, '' as T[Path<T>]);
          },
        })}
      />
      <Select
        label="Distrito"
        options={distritoOptions}
        disabled={!province}
        {...register('district' as Path<T>, {
          onChange: () => {
            setValue('corregimiento' as Path<T>, '' as T[Path<T>]);
          },
        })}
      />
      <Select
        label="Corregimiento"
        options={corregimientoOptions}
        disabled={!district}
        {...register('corregimiento' as Path<T>)}
      />
    </>
  );
}
