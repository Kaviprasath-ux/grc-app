import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";

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
    const endpoint = `/api/semanticMatch_process_asset_riskV2_status/${jobId}`;

    try {
        if (!jobId) {
            return NextResponse.json(
                { error: "Job ID is required" },
                { status: 400 }
            );
        }

        const response = await aiApiClient.get(endpoint);
        const result = response.data;
        const latency = Date.now() - startTime;

        console.log(`[AI] GET  ${endpoint} → ${result.status || 'unknown'}`);

        // Update job status in DB
        if (result.status) {
            const dbStatus = result.status.toUpperCase();
            await aiAuditService.updateJobStatus(jobId, dbStatus);
        }

        // Log operation
        await aiAuditService.logOperation({
            jobId,
            endpoint,
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
    } catch (error: any) {
        const latency = Date.now() - startTime;
        console.log(`[AI] GET  ${endpoint} → ${error.status || 500} (error)`);

        await aiAuditService.logOperation({
            jobId,
            endpoint,
            method: 'GET',
            error: error.message,
            statusCode: error.status || 500,
            latencyMs: latency,
            userId: session.id
        });

        return NextResponse.json(
            { error: "Failed to check job status", details: error.message },
            { status: error.status || 500 }
        );
    }
}

export const GET = withAuthOnly(handler);
