/**
 * Layout para páginas de autenticación (login, etc.)
 * Centrado vertical y horizontal con fondo limpio.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      {children}
    </div>
  );
}
