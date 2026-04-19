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
  // Serve uploaded files via the existing /api/uploads/[...path] route.
  // `file-upload.ts` returns URLs like `/uploads/artifacts/foo.png`; without
  // this rewrite the browser would hit a non-existent /uploads/* path and
  // render a broken-image icon. Rewrite keeps existing DB URLs valid.
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: "/api/uploads/:path*",
      },
    ];
  },
};

export default nextConfig;
