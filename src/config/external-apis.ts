/**
 * external-apis.ts
 *
 * Configuration for external API services.
 * Uses AI_API_BASE_URL as the single source for AI backend URL.
 */

const AI_API_BASE_URL = process.env.AI_API_BASE_URL || '';

export const EXTERNAL_API_URLS = {
  AI_SERVICE: AI_API_BASE_URL,
  // Kept for backward compatibility - both point to same URL
  PYTHON_BACKEND: AI_API_BASE_URL,
} as const;

// Helper to validate required env vars at runtime
export const validateExternalApiConfig = () => {
  if (!process.env.AI_API_BASE_URL) {
    throw new Error('AI_API_BASE_URL environment variable is required');
  }
};

export const EXTERNAL_API_SECRETS = {
  PYTHON_API_SECRET: process.env.PYTHON_API_SECRET,
} as const;

/**
 * Get full URL for an external API endpoint
 */
export const getExternalApiUrl = (service: keyof typeof EXTERNAL_API_URLS, path: string) => {
  const baseUrl = EXTERNAL_API_URLS[service];

  // Runtime validation - throw error if service URL is not configured
  if (!baseUrl) {
    throw new Error(`${service} URL is not configured. Please set AI_API_BASE_URL environment variable.`);
  }

  // Normalize: remove trailing slash from base, ensure leading slash on path
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.replace(/^\/+/, '');

  return `${normalizedBase}/${normalizedPath}`;
};
