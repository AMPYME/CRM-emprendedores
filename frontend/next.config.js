/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuración base de Next.js
  reactStrictMode: true,

  // Variables de entorno públicas
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || 'http://192.168.99.60:4000/api/v1',
  },
};

module.exports = nextConfig;
