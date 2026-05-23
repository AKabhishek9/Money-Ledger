import type { NextConfig } from 'next';

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      // App shell: serve from cache instantly when offline
      // Falls back to network only if not cached yet
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
      // Firestore API — never cache, always network only
      urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/,
      handler: 'NetworkOnly',
    },
    {
      // Firebase Auth — short timeout, fall back to cache
      urlPattern: /^https:\/\/.*\.googleapis\.com\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'firebase-auth',
        networkTimeoutSeconds: 3,
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
