/**
 * Layout de autenticación a pantalla completa (login AMPYME).
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-white">{children}</div>;
}
