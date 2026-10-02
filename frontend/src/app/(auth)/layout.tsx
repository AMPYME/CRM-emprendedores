/**
 * Layout de autenticación a pantalla completa (login AMPYME).
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="h-dvh max-h-dvh overflow-hidden bg-slate-50">{children}</div>;
}
