/**
 * Categorías de gestión para cartera de seguimiento.
 * Alineadas con los valores usados en seeds y datos de referencia del sistema.
 * El backend almacena `category` como texto libre (sin catálogo dedicado).
 */
export const PORTFOLIO_CATEGORIES = [
  'Financiamiento',
  'Asistencia Técnica',
  'Registro Empresarial',
  'Capacitación',
  'Formalización',
] as const;

export type PortfolioCategory = (typeof PORTFOLIO_CATEGORIES)[number];

export const portfolioCategoryOptions = [
  { value: '', label: 'Sin categoría' },
  ...PORTFOLIO_CATEGORIES.map((c) => ({ value: c, label: c })),
];
