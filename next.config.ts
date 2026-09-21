import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  output: 'export',
  distDir: process.env.SENSINGWORKS_E2E === '1' ? '.next-e2e' : '.next',
  trailingSlash: true,
  images: { unoptimized: true },
  devIndicators: false,
};
export default nextConfig;
