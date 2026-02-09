import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { AI_ENDPOINTS } from "@/lib/ai-endpoints";
import { missingFieldResponse, errorResponse } from "@/lib/ai-route-helpers";

/**
 * POST /api/ai/compliance/control-code-query
 *
 * Query control codes by description using AI semantic matching.
 * Aligned with RunPod /api/control_code_query OpenAPI contract.
 */
async function handler(
    req: NextRequest,
    _context: unknown,
    session: AuthenticatedRequest['user']
) {
    const startTime = Date.now();
    const userId = session.id;

    try {
        const body = await req.json();
        const { description } = body;

        if (!description) {
            return missingFieldResponse("description");
        }

        // Construct payload matching OpenAPI schema: controlDescriptionPayLoad
        // IMPORTANT: Use customerAccountId for tenant isolation (matches base_id from ingest)
        const payload = {
            description,
            user_id: session.customerAccountId || userId,
        };

        // Call backend API
        const response = await aiApiClient.post(
            AI_ENDPOINTS.CONTROL_CODE_QUERY,
            payload
        );

        const resultData = response.data;
        const latency = Date.now() - startTime;

        // Log operation
        await aiAuditService.logOperation({
            endpoint: AI_ENDPOINTS.CONTROL_CODE_QUERY,
            method: 'POST',
            requestBody: payload,
            responseBody: resultData,
            userId,
            latencyMs: latency,
            statusCode: 200,
        });

        return NextResponse.json(resultData);
    } catch (error: unknown) {
        const latency = Date.now() - startTime;
        const err = error as { message?: string; response?: { status?: number }; status?: number };

        console.error("[Control Code Query] Error:", err.message);

        await aiAuditService.logOperation({
            endpoint: AI_ENDPOINTS.CONTROL_CODE_QUERY,
            method: 'POST',
            requestBody: null,
            responseBody: { error: err.message },
            userId,
            latencyMs: latency,
            statusCode: err.response?.status || err.status || 500,
        });

        return errorResponse(
            err.message || "Failed to query control code",
            err.response?.status || err.status || 500
        );
    }
}

export const POST = withAuthOnly(handler);
