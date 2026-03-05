/**
 * tprm-ai-endpoints.ts
 *
 * Single source of truth for TPRM AI API endpoints.
 * Separate from main AI endpoints for better organization.
 */

// ============================================================================
// TPRM AI BASE URL
// ============================================================================

export const TPRM_AI_BASE_URL = process.env.TPRM_AI_API_URL || 'https://a4t2jogsl4815o-7000.proxy.runpod.net';

// ============================================================================
// TPRM AI API ENDPOINTS
// ============================================================================

export const TPRM_AI_ENDPOINTS = {
  // ─────────────────────────────────────────────────────────────────────────
  // Vendor Risk Assessment (async job flow: submit -> poll -> result)
  // ─────────────────────────────────────────────────────────────────────────
  RISK_ASSESS_SUBMIT: '/risk_score_assess/submit',
  RISK_ASSESS_STATUS: '/risk_score_assess/status', // Append /{job_id}
  RISK_ASSESS_RESULT: '/risk_score_assess/result', // Append /{job_id}

  // ─────────────────────────────────────────────────────────────────────────
  // Bulk/Multi-Vendor Assessment
  // ─────────────────────────────────────────────────────────────────────────
  RISK_ASSESS_MULTIPLE: '/risk_score_assess/multiple',
  RISK_ASSESS_CSV: '/risk_score_assess/csv',

  // ─────────────────────────────────────────────────────────────────────────
  // Health Check
  // ─────────────────────────────────────────────────────────────────────────
  HEALTH: '/health',
} as const;

// Type for endpoint values
export type TPRMAIEndpoint = typeof TPRM_AI_ENDPOINTS[keyof typeof TPRM_AI_ENDPOINTS];

// ============================================================================
// ENDPOINT METADATA (for logging)
// ============================================================================

export const TPRM_ENDPOINT_NAMES: Record<string, string> = {
  [TPRM_AI_ENDPOINTS.RISK_ASSESS_SUBMIT]: 'Vendor Risk Assessment Submit',
  [TPRM_AI_ENDPOINTS.RISK_ASSESS_STATUS]: 'Vendor Risk Assessment Status',
  [TPRM_AI_ENDPOINTS.RISK_ASSESS_RESULT]: 'Vendor Risk Assessment Result',
  [TPRM_AI_ENDPOINTS.RISK_ASSESS_MULTIPLE]: 'Multi-Vendor Risk Assessment',
  [TPRM_AI_ENDPOINTS.RISK_ASSESS_CSV]: 'CSV Vendor Risk Assessment',
  [TPRM_AI_ENDPOINTS.HEALTH]: 'TPRM AI Health Check',
};

/**
 * Get human-readable name for a TPRM endpoint
 */
export function getTPRMEndpointName(endpoint: string): string {
  // Check exact match first
  if (TPRM_ENDPOINT_NAMES[endpoint]) return TPRM_ENDPOINT_NAMES[endpoint];

  // Check if endpoint starts with any known pattern (for dynamic routes)
  for (const [pattern, name] of Object.entries(TPRM_ENDPOINT_NAMES)) {
    if (endpoint.startsWith(pattern)) return name;
  }

  return endpoint;
}

/**
 * Build full URL for TPRM AI endpoint
 */
export function getTPRMAIUrl(endpoint: string, jobId?: string): string {
  const baseUrl = TPRM_AI_BASE_URL.replace(/\/+$/, '');
  const normalizedEndpoint = endpoint.replace(/^\/+/, '');

  if (jobId) {
    return `${baseUrl}/${normalizedEndpoint}/${encodeURIComponent(jobId)}`;
  }

  return `${baseUrl}/${normalizedEndpoint}`;
}
