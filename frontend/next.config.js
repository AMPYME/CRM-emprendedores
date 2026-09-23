/** @type {import('next').NextConfig} */
function asHttp(url) {
  return url.replace(/^https:\/\//i, 'http://').replace(/\/$/, '');
}

const apiProxyTarget = asHttp(
  process.env.API_PROXY_TARGET ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://api-emprendedores.ampyme.local/api/v1'
);

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
      process.env.NEXT_PUBLIC_API_URL || 'http://192.168.99.60:4000/api/v1',
    NEXT_PUBLIC_WS_URL:
      process.env.NEXT_PUBLIC_WS_URL || 'ws://192.168.99.60:4000/ws/intake',
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
