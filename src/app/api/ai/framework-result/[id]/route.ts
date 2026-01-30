import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { saveFrameworkFromAIResult } from "@/services/framework-persistence";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/framework-result/{jobId}
 * 
 * Get the result of a completed framework generation job.
 * This is Step 3 of the 3-step async process.
 * 
 * IMPORTANT: This route now handles server-side persistence (Rule #6).
 */
async function handler(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
    session: AuthenticatedRequest['user']
) {
    const startTime = Date.now();
    const { id } = await context.params;
    const endpoint = `/api/framework_job_result/${id}`;

    try {
        if (!id) {
            return NextResponse.json(
                { error: "Job ID is required" },
                { status: 400 }
            );
        }

        console.log(`[AI Framework Result] Fetching result for ID: ${id}`);

        // Call Python backend
        const response = await aiApiClient.get(endpoint);
        const aiResult = response.data;

        console.log(`[AI Framework Result] AI returned ${aiResult.total_requirements || 0} requirements`);

        // SERVER-SIDE PERSISTENCE (Target State Implementation)
        // 1. Retrieve job metadata
        const job = await prisma.aIJob.findUnique({
            where: { providerJobId: id }
        });

        if (!job) {
            console.warn(`[AI Framework Result] AIJob record not found for ${id}. Persistence may be limited.`);
        }

        const metadata = job?.metadata ? JSON.parse(job.metadata) : {};

        // 2. Persist to domain tables
        console.log(`[AI Framework Result] Persisting to database...`);
        const saveResult = await saveFrameworkFromAIResult(aiResult, {
            framework_name: metadata.framework_name || aiResult.framework_name || "Generated Framework",
            description: metadata.description || undefined,
            type: metadata.type || undefined,
            country: metadata.country || undefined,
            industry: metadata.industry || undefined,
            code: metadata.code || undefined,
        });

        // 3. Mark job as COMPLETED
        await aiAuditService.updateJobStatus(id, 'COMPLETED');

        // Log operation
        await aiAuditService.logOperation({
            jobId: id,
            endpoint,
            method: 'GET',
            responseBody: { success: true, frameworkId: saveResult.frameworkId },
            statusCode: response.status,
            latencyMs: Date.now() - startTime,
            userId: session.id
        });

        // Return combined result to UI
        return NextResponse.json({
            success: true,
            ...aiResult,
            ...saveResult
        });
    } catch (error: any) {
        console.error(`[AI Framework Result] Error for ${id}:`, error);

        const statusCode = error.status || 500;
        const errorMsg = error.message || "Internal server error";

        // Update job status to FAILED if it was in the DB
        if (id) {
            await aiAuditService.updateJobStatus(id, 'FAILED');
        }

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
                error: "Failed to process framework result",
                details: error.data || errorMsg
            },
            { status: statusCode }
        );
    }
}

export const GET = withAuthOnly(handler);
