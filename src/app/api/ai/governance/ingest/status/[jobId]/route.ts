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
            return unauthorizedResponse();
        }
        userId = session.user.id;

        const { jobId } = await context.params;

        if (!jobId) {
            return missingFieldResponse("jobId");
        }

        // Call backend to check job status
        const response = await aiApiClient.get(`${AI_ENDPOINTS.INGEST_STATUS}/${jobId}`);

        const statusData = response.data as { status?: string };

        // Update AIJob status in database
        await aiAuditService.updateJobStatus(
            jobId,
            statusData.status?.toUpperCase() || 'PROCESSING'
        );

        const latency = Date.now() - startTime;

        // Log operation
        await aiAuditService.logOperation({
            endpoint: AI_ENDPOINTS.INGEST_STATUS,
            method: 'GET',
            requestBody: null,
            responseBody: statusData,
            userId,
            latencyMs: latency,
            statusCode: 200,
        });

        return NextResponse.json(statusData);
    } catch (error: unknown) {
        const latency = Date.now() - startTime;
        const err = error as { message?: string; response?: { status?: number }; status?: number };

        console.error("[Governance Ingest Status] Error:", err);

        await aiAuditService.logOperation({
            endpoint: AI_ENDPOINTS.INGEST_STATUS,
            method: 'GET',
            requestBody: null,
            responseBody: { error: err.message },
            userId,
            latencyMs: latency,
            statusCode: err.response?.status || err.status || 500,
        });

        return errorResponse("Failed to check ingest status", err.response?.status || err.status || 500, {
            details: err.message,
        });
    }
}
