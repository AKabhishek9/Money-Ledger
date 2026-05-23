import type { NextConfig } from 'next';

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/money-ledger.*\.web\.app\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'pages',
        expiration: {
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
      },
    },
    {
      urlPattern: /^https:\/\/.*\.googleapis\.com\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'firebase-auth',
        networkTimeoutSeconds: 5,
      },
    },
  ],
});

const nextConfig: NextConfig = {
  reactStrictMode: false,
  output: 'export',
  trailingSlash: false,
  turbopack: {},
};

export default withPWA(nextConfig);
