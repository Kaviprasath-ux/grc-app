/**
 * tprm-ai-client.ts
 *
 * Standardized client for TPRM AI Backend API.
 * Follows the same patterns as ai-api-client.ts but with TPRM-specific configuration.
 */

import { TPRM_AI_BASE_URL, getTPRMEndpointName, getTPRMAIUrl } from './tprm-ai-endpoints';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_SECRET = process.env.PYTHON_API_SECRET;

// ============================================================================
// TYPES
// ============================================================================

export interface VendorRiskRequest {
  vendor_name: string;
  vendor_url: string;
  require_realtime?: boolean;
  min_intel?: number;
}

export interface TPRMAIResponse<T = unknown> {
  data: T;
  status: number;
  requestId: string;
  latencyMs: number;
}

export interface JobSubmitResponse {
  job_id: string;
  status?: string;
  message?: string;
}

export interface JobStatusResponse {
  status: string;
  progress?: number;
  error?: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

function generateRequestId(): string {
  return `tprm_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function safeJsonStringify(value: unknown, indent: number = 2): string {
  try {
    return JSON.stringify(value, null, indent);
  } catch {
    return String(value);
  }
}

// ============================================================================
// TPRM AI API CLIENT CLASS
// ============================================================================

class TPRMAIClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = TPRM_AI_BASE_URL.replace(/\/+$/, '');
  }

  /**
   * Make a request to the TPRM AI backend
   */
  private async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
    requestBody?: unknown
  ): Promise<TPRMAIResponse<T>> {
    const requestId = generateRequestId();
    const endpointName = getTPRMEndpointName(endpoint);
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const method = options.method || 'GET';
    const startTime = Date.now();

    // ═══════════════════════════════════════════════════════════════════════
    // REQUEST LOG
    // ═══════════════════════════════════════════════════════════════════════
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`[TPRM AI REQUEST] ${endpointName}`);
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
      console.error(`[${requestId}] ❌ ERROR: TPRM_AI_API_URL is not set`);
      console.log(`${'═'.repeat(80)}\n`);
      throw { status: 500, message: 'TPRM AI service URL not configured', requestId };
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
        console.log(`[TPRM AI RESPONSE] ${endpointName}`);
        console.log(`${'─'.repeat(80)}`);
        console.log(`[${requestId}] Status: ${response.status} ${response.statusText}`);
        console.log(`[${requestId}] Latency: ${responseTime}ms`);
        console.error(`[${requestId}] ❌ PARSE ERROR: Non-JSON response`);
        console.log(`[${requestId}] Raw Response: ${responseText.substring(0, 500)}`);
        console.log(`${'═'.repeat(80)}\n`);
        throw {
          status: response.status || 502,
          message: `TPRM AI service returned non-JSON response`,
          rawResponse: responseText.substring(0, 200),
          requestId,
        };
      }

      // ═══════════════════════════════════════════════════════════════════════
      // RESPONSE LOG
      // ═══════════════════════════════════════════════════════════════════════
      console.log(`${'─'.repeat(80)}`);
      console.log(`[TPRM AI RESPONSE] ${endpointName}`);
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
        let errorMessage = 'TPRM AI Service Error';
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
      console.log(`[TPRM AI ERROR] ${endpointName}`);
      console.log(`${'─'.repeat(80)}`);

      if (err.name === 'AbortError') {
        console.error(`[${requestId}] ❌ TIMEOUT ERROR after ${responseTime}ms`);
        console.log(`${'═'.repeat(80)}\n`);
        throw {
          status: 504,
          message: 'TPRM AI service request timed out. Please try again.',
          requestId,
        };
      }

      console.error(`[${requestId}] ❌ CONNECTION ERROR after ${responseTime}ms`);
      console.error(`[${requestId}] Error: ${err.message || 'Unknown error'}`);
      console.log(`${'═'.repeat(80)}\n`);

      throw {
        status: 500,
        message: err.message || 'Failed to connect to TPRM AI service',
        requestId,
      };
    }
  }

  /**
   * POST request with JSON body
   */
  async post<T = unknown>(endpoint: string, body: unknown): Promise<TPRMAIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }, body);
  }

  /**
   * GET request
   */
  async get<T = unknown>(endpoint: string): Promise<TPRMAIResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HIGH-LEVEL METHODS FOR VENDOR RISK ASSESSMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Submit a vendor risk assessment job
   */
  async submitVendorAssessment(vendor: VendorRiskRequest): Promise<TPRMAIResponse<JobSubmitResponse>> {
    return this.post<JobSubmitResponse>('/risk_score_assess/submit', vendor);
  }

  /**
   * Check status of a vendor risk assessment job
   */
  async getAssessmentStatus(jobId: string): Promise<TPRMAIResponse<JobStatusResponse>> {
    return this.get<JobStatusResponse>(`/risk_score_assess/status/${encodeURIComponent(jobId)}`);
  }

  /**
   * Get result of a completed vendor risk assessment job
   */
  async getAssessmentResult<T = unknown>(jobId: string): Promise<TPRMAIResponse<T>> {
    return this.get<T>(`/risk_score_assess/result/${encodeURIComponent(jobId)}`);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<TPRMAIResponse<unknown>> {
    return this.get('/health');
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

const tprmAIClient = new TPRMAIClient();
export default tprmAIClient;
