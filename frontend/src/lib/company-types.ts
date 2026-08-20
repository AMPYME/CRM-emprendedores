export const COMPANY_TYPE_VALUES = [
  { value: 'S.A.', label: 'S.A.' },
  { value: 'S.EP.', label: 'S.EP.' },
  { value: 'INC.', label: 'INC.' },
  { value: 'Corp.', label: 'Corp.' },
  { value: 'S. de R.L.', label: 'S. de R.L.' },
] as const;

export const COMPANY_TYPE_OPTIONS = [
  { value: '', label: 'Seleccionar' },
  ...COMPANY_TYPE_VALUES,
];

export function companyTypeLabel(value: string | null | undefined): string {
  if (!value) return '';
  return COMPANY_TYPE_VALUES.find((o) => o.value === value)?.label ?? value;
}
