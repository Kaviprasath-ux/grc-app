import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { AI_ENDPOINTS } from "@/lib/ai-endpoints";
import {
  unauthorizedResponse,
  missingFieldResponse,
  errorResponse,
} from "@/lib/ai-route-helpers";

/**
 * POST /api/ai/compliance/self-assessment
 *
 * Run AI-powered self-assessment query on compliance/policy documents.
 * Aligned with RunPod /api/grc_selfassesment_query OpenAPI contract.
 */
export async function POST(req: NextRequest) {
    const startTime = Date.now();
    let userId: string | undefined;

    try {
        const session = await auth();
        if (!session?.user) {
            return unauthorizedResponse();
        }
        userId = session.user.id;

        const body = await req.json();
        const { question } = body;

        if (!question) {
            return missingFieldResponse("question");
        }

        // Construct payload matching OpenAPI schema: queryPayLoad
        const payload = {
            question,
            user_id: userId,
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
            err.message || "Failed to run self-assessment",
            err.response?.status || err.status || 500
        );
    }
}
