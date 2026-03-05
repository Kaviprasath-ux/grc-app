/**
 * regulatory-ai-client.ts
 *
 * Standardized client for Regulatory Intelligence AI Backend API.
 * Follows the same patterns as tprm-ai-client.ts.
 */

import { REGULATORY_AI_BASE_URL, getRegulatoryEndpointName, REGULATORY_AI_ENDPOINTS } from './regulatory-ai-endpoints';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_SECRET = process.env.PYTHON_API_SECRET;

// ============================================================================
// TYPES
// ============================================================================

export interface RegulatoryIntelligenceRequest {
  company_name: string;
  country_of_incorporation: string;
  countries_of_operation: string[];
  industry: string;
  organisation_type: string;
  technology_used: string[];
}

export interface RegulationSuggestion {
  name: string;
  type: string;
  reason: string;
}

export interface RegulatoryIntelligenceResponse {
  mandatory: RegulationSuggestion[];
  recommended: RegulationSuggestion[];
  optional: RegulationSuggestion[];
}

export interface RegulatoryAIResponse<T = unknown> {
  data: T;
  status: number;
  requestId: string;
  latencyMs: number;
}

// ============================================================================
// UTILITIES
// ============================================================================

function generateRequestId(): string {
  return `reg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function safeJsonStringify(value: unknown, indent: number = 2): string {
  try {
    return JSON.stringify(value, null, indent);
  } catch {
    return String(value);
  }
}

// ============================================================================
// REGULATORY AI API CLIENT CLASS
// ============================================================================

class RegulatoryAIClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = REGULATORY_AI_BASE_URL.replace(/\/+$/, '');
  }

  /**
   * Make a request to the Regulatory AI backend
   */
  private async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
    requestBody?: unknown
  ): Promise<RegulatoryAIResponse<T>> {
    const requestId = generateRequestId();
    const endpointName = getRegulatoryEndpointName(endpoint);
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const method = options.method || 'GET';
    const startTime = Date.now();

    // ═══════════════════════════════════════════════════════════════════════
    // REQUEST LOG
    // ═══════════════════════════════════════════════════════════════════════
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`[REGULATORY AI REQUEST] ${endpointName}`);
    console.log(`${'═'.repeat(80)}`);
    console.log(`[${requestId}] Calling: ${method} ${endpoint}`);
    console.log(`[${requestId}] Full URL: ${url}`);
    console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);

    if (requestBody) {
      console.log(`[${requestId}] Payload:`);
      console.log(safeJsonStringify(requestBody, 2));
    }
    console.log(`${'─'.repeat(80)}`);

    // Validate configuration
    if (!this.baseUrl) {
      console.error(`[${requestId}] ❌ ERROR: REGULATORY_AI_API_URL is not set`);
      console.log(`${'═'.repeat(80)}\n`);
      throw { status: 500, message: 'Regulatory AI service URL not configured', requestId };
    }

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'accept': 'application/json',
    };

    if (API_SECRET) {
      headers['auth'] = API_SECRET;
    }

    try {
      // Create AbortController for timeout (5 minutes for AI processing)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...(options.headers as Record<string, string>) },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      const responseText = await response.text();

      // Try to parse as JSON
      let data: T;
      try {
        data = JSON.parse(responseText) as T;
      } catch {
        console.log(`${'─'.repeat(80)}`);
        console.log(`[REGULATORY AI RESPONSE] ${endpointName}`);
        console.log(`${'─'.repeat(80)}`);
        console.log(`[${requestId}] Status: ${response.status} ${response.statusText}`);
        console.log(`[${requestId}] Latency: ${responseTime}ms`);
        console.error(`[${requestId}] ❌ PARSE ERROR: Non-JSON response`);
        console.log(`[${requestId}] Raw Response: ${responseText.substring(0, 500)}`);
        console.log(`${'═'.repeat(80)}\n`);
        throw {
          status: response.status || 502,
          message: `Regulatory AI service returned non-JSON response`,
          rawResponse: responseText.substring(0, 200),
          requestId,
        };
      }

      // ═══════════════════════════════════════════════════════════════════════
      // RESPONSE LOG
      // ═══════════════════════════════════════════════════════════════════════
      console.log(`${'─'.repeat(80)}`);
      console.log(`[REGULATORY AI RESPONSE] ${endpointName}`);
      console.log(`${'─'.repeat(80)}`);
      console.log(`[${requestId}] Status: ${response.status} ${response.statusText}`);
      console.log(`[${requestId}] Latency: ${responseTime}ms`);
      console.log(`[${requestId}] Response Size: ${responseText.length} bytes`);

      if (!response.ok) {
        console.error(`[${requestId}] ❌ API ERROR`);
        console.log(`[${requestId}] Error Response:`);
        console.log(safeJsonStringify(data, 2));
        console.log(`${'═'.repeat(80)}\n`);

        const errorData = data as Record<string, unknown>;
        let errorMessage = 'Regulatory AI Service Error';
        if (errorData.error && typeof errorData.error === 'string') {
          errorMessage = errorData.error;
        } else if (errorData.detail) {
          if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
            const firstError = errorData.detail[0] as { msg?: string };
            errorMessage = firstError.msg || 'Validation error';
          }
        }

        throw {
          status: response.status,
          message: errorMessage,
          data,
          requestId,
        };
      }

      console.log(`[${requestId}] ✓ SUCCESS`);
      console.log(`[${requestId}] Response:`);
      console.log(safeJsonStringify(data, 2));
      console.log(`${'═'.repeat(80)}\n`);

      return { data, status: response.status, requestId, latencyMs: responseTime };
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime;
      const err = error as { requestId?: string; message?: string; name?: string };

      if (err.requestId) {
        throw error;
      }

      console.log(`${'─'.repeat(80)}`);
      console.log(`[REGULATORY AI ERROR] ${endpointName}`);
      console.log(`${'─'.repeat(80)}`);

      if (err.name === 'AbortError') {
        console.error(`[${requestId}] ❌ TIMEOUT ERROR after ${responseTime}ms`);
        console.log(`${'═'.repeat(80)}\n`);
        throw {
          status: 504,
          message: 'Regulatory AI service request timed out. Please try again.',
          requestId,
        };
      }

      console.error(`[${requestId}] ❌ CONNECTION ERROR after ${responseTime}ms`);
      console.error(`[${requestId}] Error: ${err.message || 'Unknown error'}`);
      console.log(`${'═'.repeat(80)}\n`);

      throw {
        status: 500,
        message: err.message || 'Failed to connect to Regulatory AI service',
        requestId,
      };
    }
  }

  /**
   * POST request with JSON body
   */
  async post<T = unknown>(endpoint: string, body: unknown): Promise<RegulatoryAIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }, body);
  }

  /**
   * GET request
   */
  async get<T = unknown>(endpoint: string): Promise<RegulatoryAIResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HIGH-LEVEL METHODS FOR REGULATORY INTELLIGENCE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get regulatory intelligence suggestions for an organisation profile
   */
  async suggestRegulations(
    request: RegulatoryIntelligenceRequest
  ): Promise<RegulatoryAIResponse<RegulatoryIntelligenceResponse>> {
    return this.post<RegulatoryIntelligenceResponse>(
      REGULATORY_AI_ENDPOINTS.INTELLIGENCE_HUB,
      request
    );
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<RegulatoryAIResponse<unknown>> {
    return this.get('/health');
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

const regulatoryAIClient = new RegulatoryAIClient();
export default regulatoryAIClient;
