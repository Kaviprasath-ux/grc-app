/**
 * app-url.ts
 *
 * Centralized application URL configuration.
 * Resolves the correct base URL depending on the environment:
 *  - Vercel:   Uses NEXTAUTH_URL (set in Vercel env vars)
 *  - RunPod:   Uses NEXT_PUBLIC_APP_URL (set in RunPod .env)
 *  - Local:    Falls back to http://localhost:3000
 *
 * Priority order:
 *  1. NEXT_PUBLIC_APP_URL  — explicit override for any environment
 *  2. NEXTAUTH_URL         — set by Vercel deployments
 *  3. http://localhost:3000 — local development fallback
 */

export function getAppUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000';

  // Strip trailing slash for consistent URL joining
  return url.replace(/\/+$/, '');
}

/**
 * Build an absolute URL from a relative path.
 * e.g. getAbsoluteUrl('/dashboard') => 'https://runpod-host:9000/dashboard'
 */
export function getAbsoluteUrl(path: string): string {
  const base = getAppUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
