/**
 * Centralized HTTP Client for External AI APIs
 * 
 * This module provides a configured axios instance for making requests
 * to the Python backend AI services. It handles:
 * - Base URL configuration
 * - Authentication headers
 * - Request/response interceptors
 * - Error transformation
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';

// ==================== CONFIGURATION ====================

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL;
const PYTHON_API_SECRET = process.env.PYTHON_API_SECRET;

if (!PYTHON_BACKEND_URL) {
    throw new Error('PYTHON_BACKEND_URL environment variable is not set');
}

if (!PYTHON_API_SECRET) {
    throw new Error('PYTHON_API_SECRET environment variable is not set');
}

// ==================== AXIOS INSTANCE ====================

/**
 * Configured axios instance for AI API calls
 */
export const aiApiClient: AxiosInstance = axios.create({
    baseURL: PYTHON_BACKEND_URL,
    timeout: 60000, // 60 seconds timeout
    headers: {
        'Content-Type': 'application/json',
    },
});

// WARNING FIX: Add retry strategy for transient failures (network errors, 5xx)
axiosRetry(aiApiClient, {
    retries: 2, // Max 2 retries (total 3 attempts)
    retryDelay: axiosRetry.exponentialDelay, // 500ms, 1500ms
    retryCondition: (error) => {
        // Retry on network errors or 5xx responses
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
            (error.response?.status !== undefined && error.response.status >= 500);
    },
    onRetry: (retryCount, error, requestConfig) => {
        console.log(`[AI API] Retry attempt ${retryCount} for ${requestConfig.url}: ${error.message}`);
    }
});

// ==================== REQUEST INTERCEPTOR ====================

aiApiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // Add authentication header to all requests
        config.headers.set('auth', PYTHON_API_SECRET);

        // Log request for debugging (only in development)
        if (process.env.NODE_ENV === 'development') {
            console.log('[AI API Request]', {
                method: config.method?.toUpperCase(),
                url: config.url,
                baseURL: config.baseURL,
            });
        }

        return config;
    },
    (error) => {
        console.error('[AI API Request Error]', error);
        return Promise.reject(error);
    }
);

// ==================== RESPONSE INTERCEPTOR ====================

aiApiClient.interceptors.response.use(
    (response) => {
        // Log successful response (only in development)
        if (process.env.NODE_ENV === 'development') {
            console.log('[AI API Response]', {
                status: response.status,
                url: response.config.url,
            });
        }

        return response;
    },
    (error: AxiosError) => {
        // Transform error for better handling
        const transformedError = {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            url: error.config?.url,
        };

        console.error('[AI API Response Error]', transformedError);

        return Promise.reject(transformedError);
    }
);

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if the AI API is healthy
 * 
 * IMPORTANT: This function NEVER throws errors to prevent blocking app startup.
 * It only logs warnings and returns false on failure.
 */
export async function checkAiApiHealth(): Promise<boolean> {
    try {
        const response = await aiApiClient.get('/api/health_check');
        console.log('[AI API] Health check passed');
        return response.status === 200;
    } catch (error) {
        console.warn('[AI API] Health check failed (non-blocking):', error);
        // DO NOT throw - health check failures should never crash the app
        return false;
    }
}

/**
 * Create form data for multipart/form-data requests
 */
export function createFormData(data: Record<string, string | Blob>): FormData {
    const formData = new FormData();

    Object.entries(data).forEach(([key, value]) => {
        formData.append(key, value);
    });

    return formData;
}

// ==================== EXPORTS ====================

export default aiApiClient;
