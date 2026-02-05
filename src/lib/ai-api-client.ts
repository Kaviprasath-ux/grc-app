/**
 * ai-api-client.ts
 *
 * Standardized client for interacting with the AI Backend (RunPod).
 * All AI API calls should go through this client.
 *
 * Uses AI_API_BASE_URL environment variable for the base URL.
 */

import { getEndpointName } from './ai-endpoints';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = process.env.AI_API_BASE_URL?.replace(/\/$/, '');
const API_SECRET = process.env.PYTHON_API_SECRET;

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate unique request ID for correlation
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Format FormData for logging as JSON-like object
 */
function formatFormDataAsJson(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    if (value instanceof File) {
      result[key] = {
        type: 'File',
        name: value.name,
        size: `${value.size} bytes`,
        mimeType: value.type || 'unknown',
      };
    } else {
      result[key] = value;
    }
  });
  return result;
}

/**
 * Safely stringify any value for logging
 */
function safeJsonStringify(value: unknown, indent: number = 2): string {
  try {
    return JSON.stringify(value, null, indent);
  } catch {
    return String(value);
  }
}

// ============================================================================
// AI API CLIENT CLASS
// ============================================================================

class AIApiClient {
  /**
   * Make a request to the AI backend
   */
  private async request(endpoint: string, options: RequestInit = {}, requestBody?: unknown) {
    const requestId = generateRequestId();
    const endpointName = getEndpointName(endpoint);
    const url = `${BASE_URL}${endpoint}`;
    const method = options.method || 'GET';
    const startTime = Date.now();

    // Prepare payload for logging
    const isFormData = requestBody instanceof FormData;
    const payloadForLog = isFormData ? formatFormDataAsJson(requestBody) : requestBody;

    // ═══════════════════════════════════════════════════════════════════════
    // REQUEST LOG
    // ═══════════════════════════════════════════════════════════════════════
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`[AI API REQUEST] ${endpointName}`);
    console.log(`${'═'.repeat(80)}`);
    console.log(`[${requestId}] Calling: ${method} ${endpoint}`);
    console.log(`[${requestId}] Full URL: ${url}`);
    console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);

    if (payloadForLog) {
      console.log(`[${requestId}] Payload:`);
      console.log(safeJsonStringify(payloadForLog, 2));
    }
    console.log(`${'─'.repeat(80)}`);

    // Validate configuration
    if (!BASE_URL) {
      console.error(`[${requestId}] ❌ ERROR: AI_API_BASE_URL is not set`);
      console.log(`${'═'.repeat(80)}\n`);
      throw { status: 500, message: 'AI service URL not configured', requestId };
    }

    if (!API_SECRET) {
      console.warn(`[${requestId}] ⚠️ WARNING: PYTHON_API_SECRET is not set`);
    }

    // Build headers - DO NOT set Content-Type for FormData
    const headers: Record<string, string> = {
      'auth': API_SECRET || '',
    };

    // Only set Content-Type for non-FormData requests
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    // Merge any additional headers (but filter out Content-Type for FormData)
    if (options.headers) {
      const extraHeaders = options.headers as Record<string, string>;
      for (const [key, value] of Object.entries(extraHeaders)) {
        // Skip Content-Type for FormData to let browser set boundary
        if (isFormData && key.toLowerCase() === 'content-type') {
          continue;
        }
        headers[key] = value;
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const responseTime = Date.now() - startTime;

      // Get response as text first to handle non-JSON responses
      const responseText = await response.text();

      // Try to parse as JSON
      let data: unknown;
      try {
        data = JSON.parse(responseText);
      } catch {
        // Response is not JSON
        console.log(`${'─'.repeat(80)}`);
        console.log(`[AI API RESPONSE] ${endpointName}`);
        console.log(`${'─'.repeat(80)}`);
        console.log(`[${requestId}] Status: ${response.status} ${response.statusText}`);
        console.log(`[${requestId}] Latency: ${responseTime}ms`);
        console.error(`[${requestId}] ❌ PARSE ERROR: Non-JSON response`);
        console.log(`[${requestId}] Raw Response:`);
        console.log(responseText.substring(0, 500));
        console.log(`${'═'.repeat(80)}\n`);
        throw {
          status: response.status || 502,
          message: `AI service returned non-JSON response: ${responseText.substring(0, 100)}`,
          rawResponse: responseText,
          requestId,
        };
      }

      // ═══════════════════════════════════════════════════════════════════════
      // RESPONSE LOG
      // ═══════════════════════════════════════════════════════════════════════
      console.log(`${'─'.repeat(80)}`);
      console.log(`[AI API RESPONSE] ${endpointName}`);
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
        throw {
          status: response.status,
          message: errorData.error || errorData.message || errorData.detail || 'AI Service Error',
          data: data,
          requestId,
        };
      }

      // Success log with full response
      console.log(`[${requestId}] ✓ SUCCESS`);
      console.log(`[${requestId}] Response:`);
      console.log(safeJsonStringify(data, 2));
      console.log(`${'═'.repeat(80)}\n`);

      return { data, status: response.status, requestId, latencyMs: responseTime };
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime;
      const err = error as { requestId?: string; message?: string };

      if (err.requestId) {
        // Already logged error
        throw error;
      }

      console.log(`${'─'.repeat(80)}`);
      console.log(`[AI API ERROR] ${endpointName}`);
      console.log(`${'─'.repeat(80)}`);
      console.error(`[${requestId}] ❌ CONNECTION ERROR after ${responseTime}ms`);
      console.error(`[${requestId}] Error: ${err.message || 'Unknown error'}`);
      console.log(`${'═'.repeat(80)}\n`);

      throw {
        status: 500,
        message: err.message || 'Failed to connect to AI service',
        requestId,
      };
    }
  }

  /**
   * POST request with JSON or FormData body
   */
  async post(endpoint: string, body: unknown, options: RequestInit = {}) {
    const isFormData = body instanceof FormData;
    return this.request(
      endpoint,
      {
        method: 'POST',
        body: isFormData ? (body as FormData) : JSON.stringify(body),
        ...options,
      },
      body // Pass original body for logging
    );
  }

  /**
   * GET request
   */
  async get(endpoint: string, options: RequestInit = {}) {
    return this.request(endpoint, {
      method: 'GET',
      ...options,
    });
  }

  /**
   * POST request specifically for FormData (file uploads)
   */
  async postFormData(endpoint: string, formData: FormData, options: RequestInit = {}) {
    return this.request(
      endpoint,
      {
        method: 'POST',
        body: formData,
        ...options,
      },
      formData
    );
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

const aiApiClient = new AIApiClient();
export default aiApiClient;
