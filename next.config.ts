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
  // Keep pdfkit as external to preserve its AFM font file resolution
  serverExternalPackages: ["pdfkit"],
  // Include PDFKit font files in serverless bundle for invoice generation
  outputFileTracingIncludes: {
    "/api/settings/subscription/add-module/complete": ["./node_modules/pdfkit/js/data/**/*"],
    "/api/settings/subscription/renew/complete": ["./node_modules/pdfkit/js/data/**/*"],
    "/api/settings/subscription/upgrade/complete": ["./node_modules/pdfkit/js/data/**/*"],
    "/api/public/signup/complete": ["./node_modules/pdfkit/js/data/**/*"],
    "/api/payments/internal/payment-success": ["./node_modules/pdfkit/js/data/**/*"],
    "/api/settings/subscription/invoices/[id]/pdf": ["./node_modules/pdfkit/js/data/**/*"],
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
