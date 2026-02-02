import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";

/**
 * POST /api/ai/compliance/control-code-query
 * 
 * Query control codes by description using AI semantic matching.
 * Aligned with RunPod /api/control_code_query OpenAPI contract.
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
        const { description } = body;

        if (!description) {
            return NextResponse.json(
                { error: "description is required" },
                { status: 400 }
            );
        }

        // Construct payload matching OpenAPI schema: controlDescriptionPayLoad
        const payload = {
            description,
        };

        // Call backend API
        const response = await aiApiClient.post(
            '/api/control_code_query',
            payload
        );

        const resultData = response.data;
        const latency = Date.now() - startTime;

        // Log operation
        await aiAuditService.logOperation({
            endpoint: '/api/control_code_query',
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

        console.error("Error querying control code:", error);

        await aiAuditService.logOperation({
            endpoint: '/api/control_code_query',
            method: 'POST',
            requestBody: null,
            responseBody: { error: error.message },
            userId,
            latencyMs: latency,
            statusCode: error.response?.status || 500,
        });

        return NextResponse.json(
            {
                error: "Failed to query control code",
                details: error.message,
            },
            { status: error.response?.status || 500 }
        );
    }
}
