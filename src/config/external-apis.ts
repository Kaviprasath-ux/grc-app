// External API configuration
// Environment variables are validated at runtime when APIs are called
export const EXTERNAL_API_URLS = {
    // All URLs must be configured via environment variables - no hardcoded defaults
    AI_SERVICE: process.env.AI_API_BASE_URL || '',
    PYTHON_BACKEND: process.env.PYTHON_BACKEND_URL || '',
} as const;

export const EXTERNAL_API_SECRETS = {
    PYTHON_API_SECRET: process.env.PYTHON_API_SECRET,
} as const;

// Helper to get full URL, useful if you want to enforce trailing slashes or other normalization
export const getExternalApiUrl = (service: keyof typeof EXTERNAL_API_URLS, path: string) => {
    const baseUrl = EXTERNAL_API_URLS[service];
    // Remove user-provided leading slash from path if present to avoid double slashes if base has one?
    // Ideally just standardizing: Base shouldn't have trailing slash, path should have leading.

    const normalizedBase = baseUrl.replace(/\/+$/, '');
    const normalizedPath = path.replace(/^\/+/, '');

    return `${normalizedBase}/${normalizedPath}`;
};
