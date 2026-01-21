export const EXTERNAL_API_URLS = {
    // Use environment variables for flexibility across environments (dev, staging, prod)
    // Provide defaults or throw errors if strictly required
    AI_SERVICE: process.env.AI_API_BASE_URL || 'http://localhost:8000',
    PYTHON_BACKEND: process.env.PYTHON_BACKEND_URL || 'https://a4t2jogsl4815o-8000.proxy.runpod.net',
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
