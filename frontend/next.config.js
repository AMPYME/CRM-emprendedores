/** @type {import('next').NextConfig} */
const backendOrigin = (
  process.env.BACKEND_ORIGIN ||
  'http://api-emprendedores.ampyme.local'
).replace(/\/$/, '');

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  env: {
    // Relativo = mismo origen que el front (evita CORS en el login).
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
    NEXT_PUBLIC_WS_URL:
      process.env.NEXT_PUBLIC_WS_URL || 'ws://api-emprendedores.ampyme.local/ws/intake',
    NEXT_PUBLIC_INTAKE_FORM_URL: process.env.NEXT_PUBLIC_INTAKE_FORM_URL || '',
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendOrigin}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
