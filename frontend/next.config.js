/** @type {import('next').NextConfig} */
// Destino del rewrite /backend-api → API (alcanzable DESDE el contenedor Next).
// Producción: IP 10.14.80.245 (no *.ampyme.local).
const apiProxyTarget = (
  process.env.API_PROXY_TARGET ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://10.14.80.245/api/v1'
).replace(/\/$/, '');

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/backend-api/:path*',
        destination: `${apiProxyTarget}/:path*`,
      },
    ];
  },
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || 'http://10.14.80.245/api/v1',
    NEXT_PUBLIC_WS_URL:
      process.env.NEXT_PUBLIC_WS_URL || 'ws://10.14.80.245/ws/intake',
    NEXT_PUBLIC_INTAKE_FORM_URL:
      process.env.NEXT_PUBLIC_INTAKE_FORM_URL || '',
    NEXT_PUBLIC_FORMS_PUBLIC_URL:
      process.env.NEXT_PUBLIC_FORMS_PUBLIC_URL || 'http://programas.ampyme.gob.pa/forms',
    NEXT_PUBLIC_FORMS_ADMIN_LOGIN_URL:
      process.env.NEXT_PUBLIC_FORMS_ADMIN_LOGIN_URL ||
      'https://programas.ampyme.gob.pa/forms/admin/login/',
  },
};

module.exports = nextConfig;
