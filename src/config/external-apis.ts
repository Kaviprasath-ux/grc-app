// Environment variables for external API services
// These are validated at runtime when the APIs are actually called, not at build time
const AI_API_BASE_URL = process.env.AI_API_BASE_URL || '';
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || '';

export const EXTERNAL_API_URLS = {
    AI_SERVICE: AI_API_BASE_URL,
    PYTHON_BACKEND: PYTHON_BACKEND_URL,
} as const;

// Helper to validate required env vars at runtime
export const validateExternalApiConfig = () => {
    if (!process.env.AI_API_BASE_URL) {
        throw new Error('AI_API_BASE_URL environment variable is required');
    }
    if (!process.env.PYTHON_BACKEND_URL) {
        throw new Error('PYTHON_BACKEND_URL environment variable is required');
    }
};

export const EXTERNAL_API_SECRETS = {
    PYTHON_API_SECRET: process.env.PYTHON_API_SECRET,
} as const;

// Helper to get full URL, useful if you want to enforce trailing slashes or other normalization
export const getExternalApiUrl = (service: keyof typeof EXTERNAL_API_URLS, path: string) => {
    const baseUrl = EXTERNAL_API_URLS[service];

    // Runtime validation - throw error if service URL is not configured
    if (!baseUrl) {
        throw new Error(`${service} URL is not configured. Please set the required environment variable.`);
    }

    // Remove user-provided leading slash from path if present to avoid double slashes if base has one?
    // Ideally just standardizing: Base shouldn't have trailing slash, path should have leading.

    const normalizedBase = baseUrl.replace(/\/+$/, '');
    const normalizedPath = path.replace(/^\/+/, '');

    return `${normalizedBase}/${normalizedPath}`;
};
