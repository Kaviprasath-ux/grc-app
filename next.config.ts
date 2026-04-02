import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  productionBrowserSourceMaps: false,
  turbopack: {
    root: process.cwd(),
  },
  env: {
    RADIX_ID_DETERMINISTIC: "true",
  },
  experimental: {
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
