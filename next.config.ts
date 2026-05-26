import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // FIXED: BUG-L13
  reactStrictMode: true,
  output: 'export',
  trailingSlash: false,
  turbopack: {},
};

export default nextConfig;
