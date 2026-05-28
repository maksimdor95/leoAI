/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');

const staticExport = process.env.NEXT_STATIC_EXPORT === '1';

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
  },
  allowedDevOrigins: ['leo-ai.ru', 'www.leo-ai.ru'],
  ...(staticExport ? { output: 'export', trailingSlash: true } : {}),
  images: {
    unoptimized: true,
  },
  env: {
    API_URL: process.env.API_URL || 'http://localhost:3001',
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      silent: true,
      disableServerWebpackPlugin: true,
      disableClientWebpackPlugin: true,
    })
  : nextConfig;
