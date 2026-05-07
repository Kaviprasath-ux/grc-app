/**
 * AI Backend Configuration
 *
 * CENTRALIZED configuration for all AI API integrations.
 * Single source of truth for timeouts, polling intervals, and constants.
 */

import { AI_ENDPOINTS } from './ai-endpoints';

// ============================================================================
// POLLING CONFIGURATION
// ============================================================================

export const AI_POLLING = {
  /** Default interval between poll requests (ms) */
  DEFAULT_INTERVAL_MS: 3000,

  /** Minimum interval for polling (ms) */
  MIN_INTERVAL_MS: 2000,

  /** Maximum interval after backoff (ms) */
  MAX_INTERVAL_MS: 15000,

  /** Multiplier for exponential backoff */
  BACKOFF_MULTIPLIER: 1.5,

  /** Maximum consecutive 404s before giving up */
  MAX_CONSECUTIVE_404S: 10,

  /** Default maximum wait time for polling (ms) - 2 minutes */
  DEFAULT_MAX_WAIT_MS: 120000,

  /** Extended wait time for long-running jobs (ms) - 2 hours */
  EXTENDED_MAX_WAIT_MS: 7200000,

  /** Maximum poll attempts before timeout */
  MAX_POLL_ATTEMPTS: 120,
} as const;

// ============================================================================
// TIMEOUT CONFIGURATION
// ============================================================================

export const AI_TIMEOUTS = {
  /** Default request timeout (ms) - 2 minutes */
  DEFAULT_MS: 120000,

  /** Extended timeout for file uploads (ms) - 5 minutes */
  UPLOAD_MS: 300000,

  /** Extended timeout for AI generation tasks (ms) - 20 minutes */
  GENERATION_MS: 1200000,
} as const;

// ============================================================================
// BATCH LIMITS
// ============================================================================

export const AI_LIMITS = {
  /** Maximum items to fetch from library for semantic matching */
  MAX_LIBRARY_ITEMS: 1000,

  /** Maximum risks to process in a single batch */
  MAX_RISKS_BATCH: 500,

  /** Maximum file size for upload (bytes) - 50MB */
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
} as const;

// ============================================================================
// DOCUMENT TYPES
// ============================================================================

export const AI_DOC_TYPES = {
  EVIDENCE: 'evidence',
  POLICY: 'Policy',
  STANDARD: 'Standard',
  PROCEDURE: 'Procedure',
} as const;

export type AIDocType = typeof AI_DOC_TYPES[keyof typeof AI_DOC_TYPES];

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const AI_ERRORS = {
  SERVICE_UNAVAILABLE: 'AI service is currently unavailable. Please try again later.',
  REQUEST_TIMEOUT: 'AI request timed out. Please try again.',
  POLLING_TIMEOUT: 'Job processing timed out. The job may still complete - check back later.',
  INVALID_RESPONSE: 'Received invalid response from AI service.',
  MISSING_JOB_ID: 'No job ID returned from AI service.',
  JOB_NOT_FOUND: 'Job not found. It may have expired or been deleted.',
  AUTH_FAILED: 'Failed to authenticate with AI service.',
  RATE_LIMITED: 'Too many requests. Please wait before trying again.',
} as const;

// ============================================================================
// USER-FRIENDLY ERROR MESSAGES
// ============================================================================

export interface AIUserError {
  title: string;
  description: string;
  suggestion?: string;
  retryable: boolean;
}

/**
 * Get user-friendly error message based on HTTP status code or error type.
 * These messages are designed to be shown in toast notifications.
 */
export function getAIUserFriendlyError(
  statusCode: number,
  rawMessage?: string
): AIUserError {
  // Check for specific error patterns in the raw message
  const lowerMessage = rawMessage?.toLowerCase() || '';

  // Cloudflare 524 timeout (origin server timeout)
  if (statusCode === 524) {
    return {
      title: 'AI Service Starting Up',
      description: 'The AI server is waking up or processing a heavy load.',
      suggestion: 'Please wait 1-2 minutes and try again. The server needs time to initialize.',
      retryable: true,
    };
  }

  // Gateway timeout
  if (statusCode === 504) {
    return {
      title: 'Request Timeout',
      description: 'The AI service took too long to respond.',
      suggestion: 'The server may be processing other requests. Please try again in a moment.',
      retryable: true,
    };
  }

  // Bad gateway - server not responding
  if (statusCode === 502) {
    return {
      title: 'AI Service Unavailable',
      description: 'Unable to connect to the AI service.',
      suggestion: 'The AI server may be restarting. Please wait a few minutes and try again.',
      retryable: true,
    };
  }

  // Service unavailable
  if (statusCode === 503) {
    return {
      title: 'Service Temporarily Unavailable',
      description: 'The AI service is temporarily overloaded or under maintenance.',
      suggestion: 'Please try again in a few minutes.',
      retryable: true,
    };
  }

  // Rate limiting
  if (statusCode === 429) {
    return {
      title: 'Too Many Requests',
      description: 'You have sent too many requests in a short time.',
      suggestion: 'Please wait a moment before trying again.',
      retryable: true,
    };
  }

  // Authentication errors
  if (statusCode === 401 || statusCode === 403) {
    return {
      title: 'Authentication Error',
      description: 'Unable to authenticate with the AI service.',
      suggestion: 'Please contact your administrator to verify the AI service configuration.',
      retryable: false,
    };
  }

  // Not found
  if (statusCode === 404) {
    return {
      title: 'Resource Not Found',
      description: 'The requested AI resource was not found.',
      suggestion: 'The AI model or endpoint may have been updated. Please contact support.',
      retryable: false,
    };
  }

  // Validation errors
  if (statusCode === 400 || statusCode === 422) {
    return {
      title: 'Invalid Request',
      description: rawMessage || 'The request data was invalid.',
      suggestion: 'Please check your input and try again.',
      retryable: false,
    };
  }

  // Internal server error
  if (statusCode === 500) {
    // Check for specific patterns
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return {
        title: 'AI Processing Timeout',
        description: 'The AI model took too long to generate a response.',
        suggestion: 'The request may be complex. Try again or simplify your input.',
        retryable: true,
      };
    }
    if (lowerMessage.includes('memory') || lowerMessage.includes('oom')) {
      return {
        title: 'AI Service Overloaded',
        description: 'The AI server ran out of resources.',
        suggestion: 'The server is processing heavy workloads. Please try again later.',
        retryable: true,
      };
    }
    return {
      title: 'AI Service Error',
      description: 'An unexpected error occurred in the AI service.',
      suggestion: 'Please try again. If the issue persists, contact support.',
      retryable: true,
    };
  }

  // Network/connection errors (status 0 or undefined)
  if (!statusCode || statusCode === 0) {
    return {
      title: 'Connection Error',
      description: 'Unable to reach the AI service.',
      suggestion: 'Check your internet connection and try again.',
      retryable: true,
    };
  }

  // Default fallback
  return {
    title: 'AI Request Failed',
    description: rawMessage || 'An error occurred while communicating with the AI service.',
    suggestion: 'Please try again. If the issue persists, contact support.',
    retryable: true,
  };
}

/**
 * Format the user-friendly error for display in a toast.
 * Returns a description string that includes the suggestion if available.
 */
export function formatAIErrorForToast(error: AIUserError): string {
  if (error.suggestion) {
    return `${error.description} ${error.suggestion}`;
  }
  return error.description;
}

// ============================================================================
// LEGACY CONFIG (for backward compatibility)
// ============================================================================

export const AI_CONFIG = {
  // AI API Base URL (remove trailing slash)
  baseUrl: (process.env.AI_API_BASE_URL || '').replace(/\/$/, ''),

  // API Authentication
  apiSecret: process.env.PYTHON_API_SECRET || '',

  // Endpoints - imported from central ai-endpoints.ts
  endpoints: {
    ingest: AI_ENDPOINTS.INGEST,
    ingestStatus: AI_ENDPOINTS.INGEST_STATUS,
    ingestResult: AI_ENDPOINTS.INGEST_RESULT,
    evidenceQuery: AI_ENDPOINTS.EVIDENCE_QUERY,
  },

  // Polling configuration (use AI_POLLING for new code)
  polling: {
    intervalMs: AI_POLLING.DEFAULT_INTERVAL_MS,
    maxAttempts: AI_POLLING.MAX_POLL_ATTEMPTS,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate next interval with exponential backoff
 */
export function calculateBackoff(
  currentInterval: number,
  multiplier: number = AI_POLLING.BACKOFF_MULTIPLIER,
  maxInterval: number = AI_POLLING.MAX_INTERVAL_MS
): number {
  return Math.min(currentInterval * multiplier, maxInterval);
}

/**
 * Check if status code is retryable
 */
export function isRetryableStatus(statusCode: number): boolean {
  return [408, 429, 500, 502, 503, 504].includes(statusCode);
}

/**
 * Validate AI configuration
 */
export function validateAIConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!AI_CONFIG.baseUrl) {
    errors.push('AI_API_BASE_URL is not configured');
  }

  if (!AI_CONFIG.apiSecret) {
    errors.push('PYTHON_API_SECRET is not configured');
  }

  // Reject plaintext HTTP to the Python AI backend in production. Translation
  // and AI calls carry user content (audit findings, evidence text) that must
  // not traverse the network unencrypted. Local dev is allowed to use http://.
  if (
    process.env.NODE_ENV === 'production' &&
    AI_CONFIG.baseUrl &&
    !AI_CONFIG.baseUrl.startsWith('https://')
  ) {
    errors.push('AI_API_BASE_URL must use HTTPS in production');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get AI API headers for JSON requests
 */
export function getAIHeaders(): Record<string, string> {
  return {
    'auth': AI_CONFIG.apiSecret,
    'Content-Type': 'application/json',
  };
}

/**
 * Get AI API headers for multipart/form-data requests
 * (without Content-Type, let fetch set boundary)
 */
export function getAIMultipartHeaders(): Record<string, string> {
  return {
    'auth': AI_CONFIG.apiSecret,
  };
}
