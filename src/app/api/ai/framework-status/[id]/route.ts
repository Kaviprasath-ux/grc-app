import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/framework-status/{jobId}
 * 
 * Check the status of a framework generation job.
 * This is Step 2 of the 3-step async process.
 */
async function handler(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
    session: AuthenticatedRequest['user']
) {
    const startTime = Date.now();
    const { id } = await context.params;
    const endpoint = `/api/framework_job_status/${id}`;

    try {
        if (!id) {
            return NextResponse.json(
                { error: "Job ID is required" },
                { status: 400 }
            );
        }

        console.log(`[AI Framework Status] Checking ID: ${id}`);

        // Call Python backend via centralized client
        const response = await aiApiClient.get(endpoint);
        const result = response.data;

        // Sync with local DB
        if (result.status) {
            const dbStatus = result.status.toUpperCase();
            await aiAuditService.updateJobStatus(id, dbStatus);
        }

        // Log operation
        await aiAuditService.logOperation({
            jobId: id,
            endpoint,
            method: 'GET',
            responseBody: result,
            statusCode: response.status,
            latencyMs: Date.now() - startTime,
            userId: session.id
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error(`[AI Framework Status] Error for ${id}:`, error);

        const statusCode = error.status || 500;
        const errorMsg = error.message || "Internal server error";

        // Log failed operation
        await aiAuditService.logOperation({
            jobId: id,
            endpoint,
            method: 'GET',
            error: errorMsg,
            statusCode,
            latencyMs: Date.now() - startTime,
            userId: session.id
        });

        return NextResponse.json(
            {
                error: "Failed to check framework status",
                details: error.data || errorMsg
            },
            { status: statusCode }
        );
    }
}

export const GET = withAuthOnly(handler);
