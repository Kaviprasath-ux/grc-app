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
