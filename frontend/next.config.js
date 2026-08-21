/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
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
