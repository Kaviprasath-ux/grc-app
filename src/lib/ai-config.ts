/**
 * AI Backend Configuration
 * RunPod API Integration for Evidence AI Review
 */

export const AI_CONFIG = {
  // RunPod Base URL (remove trailing slash)
  baseUrl: (process.env.PYTHON_BACKEND_URL || 'https://your-runpod-endpoint.com').replace(/\/$/, ''),

  // API Authentication
  apiSecret: process.env.PYTHON_API_SECRET || '',

  // Endpoints
  endpoints: {
    ingest: '/api/grc_ingest',
    ingestStatus: '/api/grc_ingest_status',
    ingestResult: '/api/grc_ingest_result',
    evidenceQuery: '/api/grc_evidence_query',
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

  if (!AI_CONFIG.baseUrl || AI_CONFIG.baseUrl === 'https://your-runpod-endpoint.com') {
    errors.push('RUNPOD_API_URL is not configured');
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
 * Get RunPod API headers
 */
export function getAIHeaders(): Record<string, string> {
  return {
    'auth': AI_CONFIG.apiSecret,
    'Content-Type': 'application/json',
  };
}

/**
 * Get RunPod multipart headers (without Content-Type, let fetch set boundary)
 */
export function getAIMultipartHeaders(): Record<string, string> {
  return {
    'auth': AI_CONFIG.apiSecret,
  };
}
