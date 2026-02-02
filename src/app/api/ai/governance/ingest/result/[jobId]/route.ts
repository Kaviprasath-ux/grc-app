import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";

/**
 * GET /api/ai/governance/ingest/result/[jobId]
 * 
 * Get the result of a completed policy document ingest job.
 * Aligned with RunPod /api/grc_ingest_result/{job_id} OpenAPI contract.
 */
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ jobId: string }> }
) {
    const startTime = Date.now();
    let userId: string | undefined;

    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        userId = session.user.id;

        const { jobId } = await context.params;

        if (!jobId) {
            return NextResponse.json(
                { error: "jobId is required" },
                { status: 400 }
            );
        }

        // Call backend to get job result
        const response = await aiApiClient.get(
            `/api/grc_ingest_result/${jobId}`
        );

        const resultData = response.data;

        // Update AIJob status to COMPLETED with result
        await aiAuditService.updateJobStatus(
            jobId,
            'COMPLETED',
            JSON.stringify(resultData)
        );

        const latency = Date.now() - startTime;

        // Log operation
        await aiAuditService.logOperation({
            endpoint: `/api/grc_ingest_result/${jobId}`,
            method: 'GET',
            requestBody: null,
            responseBody: resultData,
            userId,
            latencyMs: latency,
            statusCode: 200,
        });

        return NextResponse.json(resultData);
    } catch (error: any) {
        const latency = Date.now() - startTime;

        console.error("Error getting ingest result:", error);

        await aiAuditService.logOperation({
            endpoint: `/api/grc_ingest_result/${context.params}`,
            method: 'GET',
            requestBody: null,
            responseBody: { error: error.message },
            userId,
            latencyMs: latency,
            statusCode: error.response?.status || 500,
        });

        return NextResponse.json(
            {
                error: "Failed to get ingest result",
                details: error.message,
            },
            { status: error.response?.status || 500 }
        );
    }
}
