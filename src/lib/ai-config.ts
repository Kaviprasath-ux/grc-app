/**
 * AI Backend Configuration
 * Uses AI_API_BASE_URL as the single source for AI backend URL.
 *
 * NOTE: Consider using aiApiClient directly instead of this config.
 * This file is kept for backward compatibility.
 */

import { AI_ENDPOINTS } from './ai-endpoints';

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

  // Polling configuration
  polling: {
    intervalMs: 10000, // 10 seconds
    maxAttempts: 60,   // 10 minutes max
  },
};

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
