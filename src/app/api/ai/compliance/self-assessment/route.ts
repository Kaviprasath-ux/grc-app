import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";

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
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        userId = session.user.id;

        const body = await req.json();
        const { question } = body;

        if (!question) {
            return NextResponse.json(
                { error: "question is required" },
                { status: 400 }
            );
        }

        // Construct payload matching OpenAPI schema: queryPayLoad
        const payload = {
            question,
            user_id: userId,
        };

        // Call backend API
        const response = await aiApiClient.post(
            '/api/grc_selfassesment_query',
            payload
        );

        const resultData = response.data;
        const latency = Date.now() - startTime;

        // Log operation
        await aiAuditService.logOperation({
            endpoint: '/api/grc_selfassesment_query',
            method: 'POST',
            requestBody: payload,
            responseBody: resultData,
            userId,
            latencyMs: latency,
            statusCode: 200,
        });

        return NextResponse.json(resultData);
    } catch (error: any) {
        const latency = Date.now() - startTime;

        console.error("Error running self-assessment:", error);

        await aiAuditService.logOperation({
            endpoint: '/api/grc_selfassesment_query',
            method: 'POST',
            requestBody: null,
            responseBody: { error: error.message },
            userId,
            latencyMs: latency,
            statusCode: error.response?.status || 500,
        });

        return NextResponse.json(
            {
                error: "Failed to run self-assessment",
                details: error.message,
            },
            { status: error.response?.status || 500 }
        );
    }
}
