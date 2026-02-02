import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";

/**
 * GET /api/ai/governance/ingest/status/[jobId]
 * 
 * Check the status of a policy document ingest job.
 * Aligned with RunPod /api/grc_ingest_status/{job_id} OpenAPI contract.
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

        // Call backend to check job status
        const response = await aiApiClient.get(
            `/api/grc_ingest_status/${jobId}`
        );

        const statusData = response.data;

        // Update AIJob status in database
        await aiAuditService.updateJobStatus(
            jobId,
            statusData.status?.toUpperCase() || 'PROCESSING'
        );

        const latency = Date.now() - startTime;

        // Log operation
        await aiAuditService.logOperation({
            endpoint: `/api/grc_ingest_status/${jobId}`,
            method: 'GET',
            requestBody: null,
            responseBody: statusData,
            userId,
            latencyMs: latency,
            statusCode: 200,
        });

        return NextResponse.json(statusData);
    } catch (error: any) {
        const latency = Date.now() - startTime;

        console.error("Error checking ingest status:", error);

        await aiAuditService.logOperation({
            endpoint: `/api/grc_ingest_status/${context.params}`,
            method: 'GET',
            requestBody: null,
            responseBody: { error: error.message },
            userId,
            latencyMs: latency,
            statusCode: error.response?.status || 500,
        });

        return NextResponse.json(
            {
                error: "Failed to check ingest status",
                details: error.message,
            },
            { status: error.response?.status || 500 }
        );
    }
}
