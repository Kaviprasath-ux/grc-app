import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { AI_ENDPOINTS } from "@/lib/ai-endpoints";
import {
  missingFieldResponse,
  errorResponse,
} from "@/lib/ai-route-helpers";

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/risk-semantic-match/status/{jobId}
 *
 * Check the status of a semantic matching job.
 * Uses RunPod API: GET /api/semanticMatch_process_asset_riskV2_status/{job_id}
 *
 * Status values: queued | processing | completed | error
 */
async function handler(
    req: NextRequest,
    context: { params: Promise<{ jobId: string }> },
    session: AuthenticatedRequest['user']
) {
    const startTime = Date.now();
    const { jobId } = await context.params;

    try {
        if (!jobId) {
            return missingFieldResponse("jobId");
        }

        const response = await aiApiClient.get(`${AI_ENDPOINTS.SEMANTIC_MATCH_STATUS}/${jobId}`);
        const result = response.data as { status?: string; progress?: number; message?: string };
        const latency = Date.now() - startTime;

        console.log(`[Risk Semantic Match Status] Job ${jobId}: ${result.status || 'unknown'}`);

        // Update job status in DB
        if (result.status) {
            const dbStatus = result.status.toUpperCase();
            await aiAuditService.updateJobStatus(jobId, dbStatus);
        }

        // Log operation
        await aiAuditService.logOperation({
            jobId,
            endpoint: AI_ENDPOINTS.SEMANTIC_MATCH_STATUS,
            method: 'GET',
            responseBody: result,
            statusCode: response.status,
            latencyMs: latency,
            userId: session.id
        });

        return NextResponse.json({
            job_id: jobId,
            status: result.status || "unknown",
            progress: result.progress,
            message: result.message,
        });
    } catch (error: unknown) {
        const latency = Date.now() - startTime;
        const err = error as { message?: string; status?: number };
        console.error(`[Risk Semantic Match Status] Error:`, err);

        await aiAuditService.logOperation({
            jobId,
            endpoint: AI_ENDPOINTS.SEMANTIC_MATCH_STATUS,
            method: 'GET',
            error: err.message,
            statusCode: err.status || 500,
            latencyMs: latency,
            userId: session.id
        });

        return errorResponse("Failed to check job status", err.status || 500, {
            details: err.message,
        });
    }
}

export const GET = withAuthOnly(handler);
