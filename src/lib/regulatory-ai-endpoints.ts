/**
 * regulatory-ai-endpoints.ts
 *
 * Single source of truth for Regulatory Intelligence AI API endpoints.
 * Follows the same pattern as tprm-ai-endpoints.ts.
 */

// ============================================================================
// REGULATORY AI BASE URL
// ============================================================================

export const REGULATORY_AI_BASE_URL = process.env.REGULATORY_AI_API_URL || 'https://a4t2jogsl4815o-9000.proxy.runpod.net';

// ============================================================================
// REGULATORY AI API ENDPOINTS
// ============================================================================

export const REGULATORY_AI_ENDPOINTS = {
  // ─────────────────────────────────────────────────────────────────────────
  // Regulatory Intelligence Hub - Suggest applicable regulations
  // ─────────────────────────────────────────────────────────────────────────
  INTELLIGENCE_HUB: '/api/regulatory_Intelligence_hub',

  // ─────────────────────────────────────────────────────────────────────────
  // Health Check
  // ─────────────────────────────────────────────────────────────────────────
  HEALTH: '/health',
} as const;

// Type for endpoint values
export type RegulatoryAIEndpoint = typeof REGULATORY_AI_ENDPOINTS[keyof typeof REGULATORY_AI_ENDPOINTS];

// ============================================================================
// ENDPOINT METADATA (for logging)
// ============================================================================

export const REGULATORY_ENDPOINT_NAMES: Record<string, string> = {
  [REGULATORY_AI_ENDPOINTS.INTELLIGENCE_HUB]: 'Regulatory Intelligence Hub',
  [REGULATORY_AI_ENDPOINTS.HEALTH]: 'Regulatory AI Health Check',
};

/**
 * Get human-readable name for a Regulatory AI endpoint
 */
export function getRegulatoryEndpointName(endpoint: string): string {
  // Check exact match first
  if (REGULATORY_ENDPOINT_NAMES[endpoint]) return REGULATORY_ENDPOINT_NAMES[endpoint];

  // Check if endpoint starts with any known pattern (for dynamic routes)
  for (const [pattern, name] of Object.entries(REGULATORY_ENDPOINT_NAMES)) {
    if (endpoint.startsWith(pattern)) return name;
  }

  return endpoint;
}

/**
 * Build full URL for Regulatory AI endpoint
 */
export function getRegulatoryAIUrl(endpoint: string): string {
  const baseUrl = REGULATORY_AI_BASE_URL.replace(/\/+$/, '');
  const normalizedEndpoint = endpoint.replace(/^\/+/, '');
  return `${baseUrl}/${normalizedEndpoint}`;
}
