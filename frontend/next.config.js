/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuración base de Next.js
  reactStrictMode: true,

  // Variables de entorno públicas
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || 'http://192.168.99.60:4000/api/v1',
    // WebSocket de intake (si se omite, se deriva de NEXT_PUBLIC_API_URL).
    NEXT_PUBLIC_WS_URL:
      process.env.NEXT_PUBLIC_WS_URL || 'ws://192.168.99.60:4000/ws/intake',
    // Enlace público del formulario de intake (Next.js, sin login).
    NEXT_PUBLIC_INTAKE_FORM_URL:
      process.env.NEXT_PUBLIC_INTAKE_FORM_URL || '',
  },
};

module.exports = nextConfig;
