/** Login central. El clientId es público; el secreto solo vive en el backend del CRM. */
export const ENTRA_API_URL = (
  process.env.NEXT_PUBLIC_ENTRA_API_URL || 'http://localhost:8080'
).replace(/\/$/, '');

export const ENTRA_CLIENT_ID =
  process.env.NEXT_PUBLIC_EMPRENDEDORES_CLIENT_ID || '00000000-0000-4000-8000-000000000004';

export function entraReturnUrl(): string {
  if (process.env.NEXT_PUBLIC_EMPRENDEDORES_RETURN_URL) {
    return process.env.NEXT_PUBLIC_EMPRENDEDORES_RETURN_URL;
  }
  return `${window.location.origin}/login`;
}
