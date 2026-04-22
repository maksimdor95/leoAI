/** @type {import('next').NextConfig} */
// Dev: предпочитайте `npm run dev` (чистит `.next` перед стартом). `npm run dev:fast` = next dev без
// очистки — быстрее, но снова возможны 404 на `/_next/static/chunks/*` после build/HMR.
// В webpack для dev отключён persistent cache (см. webpack ниже) — меньше «битых» чанков при dev:fast.
//
// Статический экспорт (`out/`) только при NEXT_STATIC_EXPORT=1. Раньше export включался при любом
// production build — тогда `next start` отдавал 404 на `/`, потому что при export нет серверного бандла.
// Статика: NEXT_STATIC_EXPORT=1 npm run build → `out/`; локально удобно: npm run start:static
const staticExport = process.env.NEXT_STATIC_EXPORT === '1';

const nextConfig = {
  reactStrictMode: true,
  ...(staticExport ? { output: 'export', trailingSlash: true } : {}),
  images: {
    unoptimized: true,
  },
  env: {
    API_URL: process.env.API_URL || 'http://localhost:3001',
  },
  // В dev отключаем persistent webpack cache — иначе после смены ветки, `next build` + `next dev`
  // или сбоев HMR часто появляются 404 на `/_next/static/chunks/*` (старые имена чанков).
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
