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
  // Security headers applied to every response. CSP intentionally starts in
  // Report-Only mode so violations are logged but nothing breaks; once we've
  // observed a clean report log for a few days we can flip to enforcement.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.openai.com https://*.razorpay.com",
              "frame-src https://*.razorpay.com",
              "media-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
