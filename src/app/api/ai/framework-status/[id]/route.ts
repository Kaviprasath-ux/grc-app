import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/framework-status/{jobId}
 *
 * Check the status of a framework generation job.
 * Statuses: QUEUED → PROCESSING → COMPLETED (or FAILED)
 */
async function handler(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
    session: AuthenticatedRequest['user']
) {
    const startTime = Date.now();
    const { id: jobId } = await context.params;
    const endpoint = `/api/framework_job_status/${jobId}`;

    try {
        if (!jobId) {
            return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
        }

        // Call Python backend
        const response = await aiApiClient.get(endpoint);
        const result = response.data as Record<string, unknown>;

        // Normalize status to uppercase
        const normalizedStatus = result.status ? String(result.status).toUpperCase() : undefined;

        console.log(`[Framework Status] JobID: ${jobId} | Status: ${normalizedStatus} | Time: ${Date.now() - startTime}ms`);

        // Sync with local DB
        if (normalizedStatus) {
            await aiAuditService.updateJobStatus(jobId, normalizedStatus);
        }

        // Log operation
        await aiAuditService.logOperation({
            jobId,
            endpoint,
            method: 'GET',
            responseBody: result,
            statusCode: response.status,
            latencyMs: Date.now() - startTime,
            userId: session.id
        });

        // Return normalized response
        return NextResponse.json({ ...result, status: normalizedStatus });

    } catch (error: any) {
        console.error(`[Framework Status] ❌ JobID: ${jobId} | Error: ${error.message}`);

        await aiAuditService.logOperation({
            jobId,
            endpoint,
            method: 'GET',
            error: error.message,
            statusCode: error.status || 500,
            latencyMs: Date.now() - startTime,
            userId: session.id
        });

        return NextResponse.json(
            { error: "Something went wrong. Please try again." },
            { status: error.status || 500 }
        );
    }
}

export const GET = withAuthOnly(handler);
