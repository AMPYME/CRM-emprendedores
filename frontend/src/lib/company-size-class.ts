export const COMPANY_SIZE_CLASS_VALUES = [
  {
    value: 'MICRO',
    label: 'Micro',
    range: '$0 – $150,000.00',
  },
  {
    value: 'PEQUENA',
    label: 'Pequeña',
    range: '$150,000.01 – $1,000,000.00',
  },
  {
    value: 'MEDIANA',
    label: 'Mediana',
    range: '$1,000,000.01 – $2,500,000.00',
  },
] as const;

export type CompanySizeClassValue = (typeof COMPANY_SIZE_CLASS_VALUES)[number]['value'];

export const COMPANY_SIZE_CLASS_OPTIONS = [
  { value: '', label: 'Seleccionar' },
  ...COMPANY_SIZE_CLASS_VALUES.map((o) => ({
    value: o.value,
    label: `${o.label} (${o.range})`,
  })),
];

export function companySizeClassLabel(value: string | null | undefined): string {
  if (!value) return '';
  const found = COMPANY_SIZE_CLASS_VALUES.find((o) => o.value === value);
  return found ? found.label : value;
}

export const COMPANY_SIZE_CLASS_HELP =
  'Micro: $0 – $150,000.00 · Pequeña: $150,000.01 – $1,000,000.00 · Mediana: $1,000,000.01 – $2,500,000.00';
