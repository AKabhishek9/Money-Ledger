import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  output: 'export',   // generates /out for static firebase hosting
  trailingSlash: false,
};

export default nextConfig;
