/** Login central. El clientId es público; el secreto solo vive en el backend del CRM. */
export const ENTRA_API_URL = (
  process.env.NEXT_PUBLIC_ENTRA_API_URL || 'https://users.ampyme.local'
).replace(/\/$/, '');

export const ENTRA_CLIENT_ID =
  process.env.NEXT_PUBLIC_EMPRENDEDORES_CLIENT_ID || 'c1af0f4e-6b8c-425a-be11-8789e86a82a4';

export function entraReturnUrl(): string {
  if (process.env.NEXT_PUBLIC_EMPRENDEDORES_RETURN_URL) {
    return process.env.NEXT_PUBLIC_EMPRENDEDORES_RETURN_URL;
  }
  return `${window.location.origin}/login`;
}
