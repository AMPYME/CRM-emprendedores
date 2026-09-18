/**
 * Layout raíz de la aplicación.
 * Envuelve con providers globales (React Query + Toast).
 */
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Emprendedores CRM - AMPYME',
  description: 'Sistema de gestión de cartera y CRM de emprendedores',
  icons: {
    icon: '/emprendedores-icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
