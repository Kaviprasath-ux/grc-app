import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  env: {
    RADIX_ID_DETERMINISTIC: "true",
  },
};

export default nextConfig;
