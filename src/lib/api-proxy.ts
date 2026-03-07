2
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from "@/config/external-apis";

type ApiMethod = "GET" | "POST" | "PUT" | "DELETE";

interface ProxyOptions {
    service: "PYTHON_BACKEND" | "AI_SERVICE"; // Restrict to known services
    path: string;
    method: ApiMethod;
    body?: any;
    requireAuth?: boolean;
    contentType?: string;
}

export async function proxyToExternalApi(options: ProxyOptions) {
    const { service, path, method, body, requireAuth = true } = options;

    try {
        if (requireAuth) {
            const session = await auth();
            if (!session || !session.user) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }

        const url = getExternalApiUrl(service, path);

        // Determine correct secret based on service
        // Currently assuming PYTHON_BACKEND uses PYTHON_API_SECRET
        let secret = "";
        if (service === "PYTHON_BACKEND") {
            secret = EXTERNAL_API_SECRETS.PYTHON_API_SECRET || "";
        }

        if (!secret) {
            console.error(`Missing secret for service: ${service}`);
            return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
        }

        const contentType = options.contentType || "application/json";

        const headers: HeadersInit = {
            "Content-Type": contentType,
            "x-api-secret": secret, // Standardize header if possible, or use 'auth' if legacy required. 
            // Previous code used 'auth' for one, 'x-api-secret' for others.
            // User requirements said "Security key / auth token is read from environment variables".
            // I will use 'x-api-secret' as it is more standard, but check if legacy needs 'auth'.
            // The deleted file used 'auth' for POST but 'x-api-secret' for GET status/result.
            // That is inconsistent. I should probably support both or standardize.
            // I'll stick to 'x-api-secret' but maybe send both to be safe? 
            // Or better, checking the provided code snippets in history, POST used 'auth': secret
            // GET used 'x-api-secret': secret.
            // I will reproduce that behavior via a flag or smart default, 
            // OR better, send both/standardize if I can't confirm.
            // Let's use 'x-api-secret' generally, but for semanticMatch maybe the backend expects specific headers.
            // I will use a config map for headers if needed.
            // For now, I'll send 'x-api-secret' AND 'auth' to be safe/compatible with the mixed usage I saw.
            "auth": secret,
        };

        const fetchOptions: RequestInit = {
            method,
            headers,
        };

        if (body && method !== "GET") {
            if (contentType === "application/x-www-form-urlencoded") {
                const params = new URLSearchParams();
                Object.entries(body).forEach(([key, value]) => {
                    params.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
                });
                fetchOptions.body = params;
            } else {
                fetchOptions.body = JSON.stringify(body);
            }
        }

        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`External API Error (${path}):`, response.status, errorText);
            // Try to parse JSON error if possible
            try {
                const errorJson = JSON.parse(errorText);
                return NextResponse.json(errorJson, { status: response.status });
            } catch {
                return NextResponse.json(
                    { error: `External Service Error: ${response.statusText}`, details: errorText },
                    { status: response.status }
                );
            }
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error) {
        console.error(`Proxy error for ${path}:`, error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// Re-export constants if needed by actions, or usage should be from config directly.
// The lint error said: Module '"@/lib/api-proxy"' declares 'EXTERNAL_API_SECRETS' locally, but it is not exported.
// But wait, I see `import { EXTERNAL_API_SECRETS, ... } from "@/config/external-apis";` in line 4 of api-proxy.
// So api-proxy imports it. It doesn't declare it. The lint might be confused or referring to a previous version?
// Ah, the lint error in `src/actions/control-extraction.ts` said:
// `Module '"@/lib/api-proxy"' declares 'EXTERNAL_API_SECRETS' locally` which suggests I imported it from THERE?
// In `src/actions/control-extraction.ts` I did `import { EXTERNAL_API_SECRETS } from "@/lib/api-proxy";` 
// So I should import it from `@/config/external-apis` instead in that file. Use multi_replace for that.
