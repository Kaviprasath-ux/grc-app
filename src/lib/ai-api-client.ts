
/**
 * ai-api-client.ts
 *
 * Standardized client for interacting with the Python AI Backend (Runpod).
 * Provides comprehensive logging for all API calls.
 */

const BASE_URL = process.env.PYTHON_BACKEND_URL?.replace(/\/$/, "");
const API_SECRET = process.env.PYTHON_API_SECRET;

// Endpoint name mapping for human-readable logs
const ENDPOINT_NAMES: Record<string, string> = {
    "/api/grc_ingest": "Document Ingest",
    "/api/grc_ingest_status": "Ingest Status Check",
    "/api/grc_ingest_result": "Ingest Result Fetch",
    "/api/grc_policy_query": "Policy Review",
    "/api/grc_evidence_query": "Evidence Review",
    "/api/generate_policy/": "Policy Generation",
    "/api/regenerate_policy/": "Policy Regeneration",
    "/api/grc_delete": "Document Cleanup",
    "/api/generate_process_asset_risk_v2": "Risk Evaluation",
};

// Generate unique request ID for correlation
function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// Get human-readable endpoint name
function getEndpointName(endpoint: string): string {
    // Check exact match first
    if (ENDPOINT_NAMES[endpoint]) return ENDPOINT_NAMES[endpoint];

    // Check if endpoint starts with any known pattern (for dynamic routes like /status/{jobId})
    for (const [pattern, name] of Object.entries(ENDPOINT_NAMES)) {
        if (endpoint.startsWith(pattern)) return name;
    }

    return endpoint;
}

// Truncate and format body for logging
function formatBodyForLog(body: any, maxLength: number = 500): string {
    if (!body) return "(empty)";

    if (body instanceof FormData) {
        const entries: string[] = [];
        body.forEach((value, key) => {
            if (value instanceof File) {
                entries.push(`${key}: [File: ${value.name}, ${value.size} bytes]`);
            } else {
                const strValue = String(value);
                entries.push(`${key}: ${strValue.length > 50 ? strValue.substring(0, 50) + "..." : strValue}`);
            }
        });
        return `FormData { ${entries.join(", ")} }`;
    }

    try {
        const str = typeof body === "string" ? body : JSON.stringify(body);
        return str.length > maxLength ? str.substring(0, maxLength) + "..." : str;
    } catch {
        return "(unable to serialize)";
    }
}

class AIApiClient {
    private async request(endpoint: string, options: RequestInit = {}, requestBody?: any) {
        const requestId = generateRequestId();
        const endpointName = getEndpointName(endpoint);
        const url = `${BASE_URL}${endpoint}`;
        const method = options.method || "GET";
        const startTime = Date.now();

        // ═══════════════════════════════════════════════════════════════════
        // REQUEST LOG
        // ═══════════════════════════════════════════════════════════════════
        console.log(`\n${"═".repeat(70)}`);
        console.log(`[RunPod API] ${endpointName}`);
        console.log(`${"═".repeat(70)}`);
        console.log(`[${requestId}] → ${method} ${endpoint}`);
        console.log(`[${requestId}] Full URL: ${url}`);

        if (requestBody) {
            console.log(`[${requestId}] Request Body: ${formatBodyForLog(requestBody)}`);
        }

        // Validate configuration
        if (!BASE_URL) {
            console.error(`[${requestId}] ❌ ERROR: PYTHON_BACKEND_URL is not set`);
            console.log(`${"═".repeat(70)}\n`);
            throw { status: 500, message: "AI service URL not configured", requestId };
        }

        if (!API_SECRET) {
            console.warn(`[${requestId}] ⚠️ WARNING: PYTHON_API_SECRET is not set`);
        } else {
            console.log(`[${requestId}] Auth: API Secret configured (${API_SECRET.substring(0, 4)}...)`);
        }

        // Build headers - DO NOT set Content-Type for FormData
        const isFormData = requestBody instanceof FormData;
        const headers: Record<string, string> = {
            "auth": API_SECRET || "",
        };

        // Only set Content-Type for non-FormData requests
        if (!isFormData) {
            headers["Content-Type"] = "application/json";
        }

        // Merge any additional headers (but filter out Content-Type for FormData)
        if (options.headers) {
            const extraHeaders = options.headers as Record<string, string>;
            for (const [key, value] of Object.entries(extraHeaders)) {
                // Skip Content-Type for FormData to let browser set boundary
                if (isFormData && key.toLowerCase() === "content-type") {
                    console.log(`[${requestId}] Skipping Content-Type header for FormData (browser will set boundary)`);
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

            // ═══════════════════════════════════════════════════════════════
            // RESPONSE LOG
            // ═══════════════════════════════════════════════════════════════
            console.log(`[${requestId}] ← ${response.status} ${response.statusText}`);
            console.log(`[${requestId}] Response Size: ${responseText.length} bytes`);
            console.log(`[${requestId}] Latency: ${responseTime}ms`);

            // Try to parse as JSON
            let data: any;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                // Response is not JSON
                console.error(`[${requestId}] ❌ PARSE ERROR: Non-JSON response`);
                console.error(`[${requestId}] Raw Response: ${responseText.substring(0, 300)}`);
                console.log(`${"═".repeat(70)}\n`);
                throw {
                    status: response.status || 502,
                    message: `AI service returned non-JSON response: ${responseText.substring(0, 100)}`,
                    rawResponse: responseText,
                    requestId,
                };
            }

            if (!response.ok) {
                console.error(`[${requestId}] ❌ API ERROR: ${response.status}`);
                console.error(`[${requestId}] Error Response: ${JSON.stringify(data).substring(0, 500)}`);
                console.log(`${"═".repeat(70)}\n`);
                throw {
                    status: response.status,
                    message: data.error || data.message || data.detail || "AI Service Error",
                    data: data,
                    requestId,
                };
            }

            // Success log
            console.log(`[${requestId}] ✓ SUCCESS`);
            console.log(`[${requestId}] Response: ${formatBodyForLog(data, 300)}`);
            console.log(`${"═".repeat(70)}\n`);

            return { data, status: response.status, requestId, latencyMs: responseTime };
        } catch (error: any) {
            const responseTime = Date.now() - startTime;

            if (error.requestId) {
                // Already logged error
                throw error;
            }

            console.error(`[${requestId}] ❌ CONNECTION ERROR after ${responseTime}ms`);
            console.error(`[${requestId}] Error: ${error.message}`);
            console.log(`${"═".repeat(70)}\n`);

            throw {
                status: 500,
                message: error.message || "Failed to connect to AI service",
                requestId,
            };
        }
    }

    async post(endpoint: string, body: any, options: RequestInit = {}) {
        const isFormData = body instanceof FormData;
        return this.request(
            endpoint,
            {
                method: "POST",
                body: isFormData ? body : JSON.stringify(body),
                ...options,
            },
            body // Pass original body for logging
        );
    }

    async get(endpoint: string, options: RequestInit = {}) {
        return this.request(endpoint, {
            method: "GET",
            ...options,
        });
    }
}

const aiApiClient = new AIApiClient();
export default aiApiClient;
