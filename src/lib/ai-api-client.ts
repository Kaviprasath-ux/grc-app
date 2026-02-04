
/**
 * ai-api-client.ts
 * 
 * Standardized client for interacting with the Python AI Backend (Runpod).
 */

const BASE_URL = process.env.PYTHON_BACKEND_URL?.replace(/\/$/, "");
const API_SECRET = process.env.PYTHON_API_SECRET;

class AIApiClient {
    private async request(endpoint: string, options: RequestInit = {}) {
        const url = `${BASE_URL}${endpoint}`;
        
        // Debug logging
        if (!API_SECRET) {
            console.warn("⚠️ WARNING: PYTHON_API_SECRET is not set in environment variables");
        } else {
            console.log(`✓ API Secret loaded (${API_SECRET.substring(0, 4)}...)`);
        }
        
        // Omit Content-Type for FormData - fetch sets it with boundary automatically
        const isFormData = options.body instanceof FormData;
        const headers: Record<string, string> = {
            // Backend expects 'auth' header for API key
            "auth": API_SECRET || "",
            ...(isFormData ? {} : { "Content-Type": "application/json" }),
            ...(options.headers as Record<string, string> || {}),
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });

            const data = await response.json();

            if (!response.ok) {
                throw {
                    status: response.status,
                    message: data.error || data.message || "AI Service Error",
                    data: data,
                };
            }

            return { data, status: response.status };
        } catch (error: any) {
            if (error.status) throw error;
            throw {
                status: 500,
                message: error.message || "Failed to connect to AI service",
            };
        }
    }

    async post(endpoint: string, body: any, options: RequestInit = {}) {
        const isFormData = body instanceof FormData;
        return this.request(endpoint, {
            method: "POST",
            body: isFormData ? body : JSON.stringify(body),
            ...options,
            headers: {
                ...(isFormData ? {} : { "Content-Type": "application/json" }),
                ...options.headers,
            },
        });
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
