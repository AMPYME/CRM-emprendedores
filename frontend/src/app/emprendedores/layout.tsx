/**
 * Layout público del formulario de emprendedores (sin login).
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Registro de Emprendedores — AMPYME',
  robots: { index: false, follow: false },
};

export default function PublicIntakeLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f4f6fb] text-gray-800">{children}</div>;
}
