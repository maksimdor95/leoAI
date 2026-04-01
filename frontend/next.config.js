/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Статический экспорт только для production build
  ...(process.env.NODE_ENV === 'production' ? { output: 'export' } : {}),
  images: {
    unoptimized: true,
  },
  env: {
    API_URL: process.env.API_URL || 'http://localhost:3001',
  },
};

module.exports = nextConfig;
