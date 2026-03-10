import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { AI_ENDPOINTS } from "@/lib/ai-endpoints";
import {
  missingFieldResponse,
  errorResponse,
} from "@/lib/ai-route-helpers";

/**
 * POST /api/ai/compliance/self-assessment
 *
 * Run AI-powered self-assessment query on compliance/policy documents.
 * Aligned with RunPod /api/grc_selfassesment_query OpenAPI contract.
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
        const { question } = body;

        if (!question) {
            return missingFieldResponse("question");
        }

        // Construct payload matching OpenAPI schema: queryPayLoad
        // IMPORTANT: Use customerAccountId for tenant isolation (matches base_id from ingest)
        const payload = {
            question,
            user_id: session.customerAccountId || userId,
        };

        // Call backend API using centralized endpoint constant
        const response = await aiApiClient.post(
            AI_ENDPOINTS.SELF_ASSESSMENT_QUERY,
            payload
        );

        const resultData = response.data;
        const latency = Date.now() - startTime;

        // Log operation using centralized endpoint constant
        await aiAuditService.logOperation({
            endpoint: AI_ENDPOINTS.SELF_ASSESSMENT_QUERY,
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

        console.error("[Self Assessment] Error:", err.message);

        await aiAuditService.logOperation({
            endpoint: AI_ENDPOINTS.SELF_ASSESSMENT_QUERY,
            method: 'POST',
            requestBody: null,
            responseBody: { error: err.message },
            userId,
            latencyMs: latency,
            statusCode: err.response?.status || err.status || 500,
        });

        return errorResponse(
            "Unable to run self-assessment. Please try again.",
            err.response?.status || err.status || 500
        );
    }
}

export const POST = withAuthOnly(handler);
