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
 * Fetch and persist framework generation result from AI backend.
 */
async function handler(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
    session: AuthenticatedRequest['user']
) {
    const startTime = Date.now();
    const { id: jobId } = await context.params;
    const endpoint = `/api/framework_job_result/${jobId}`;

    try {
        if (!jobId) {
            return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
        }

        console.log(`\n[Framework Result] JobID: ${jobId} | User: ${session.id}`);

        // Fetch from AI backend
        const response = await aiApiClient.get(endpoint);
        const rawData = response.data as Record<string, unknown>;

        // Log raw response for debugging
        console.log(`[Framework Result] Raw Response:`, JSON.stringify(rawData, null, 2));

        // Extract result from various possible structures
        let aiResult: Record<string, unknown>;
        if (rawData?.result && typeof rawData.result === 'object') {
            aiResult = rawData.result as Record<string, unknown>;
        } else if (rawData?.data && typeof rawData.data === 'object') {
            aiResult = rawData.data as Record<string, unknown>;
        } else {
            aiResult = rawData as Record<string, unknown>;
        }

        // Find requirements array
        const requirements = aiResult.requirements || aiResult.clauses || aiResult.sections || [];
        const reqCount = Array.isArray(requirements) ? requirements.length : 0;

        console.log(`[Framework Result] Parsed: name="${aiResult.framework_name}", requirements=${reqCount}`);

        // Warn if no requirements
        if (reqCount === 0) {
            console.warn(`[Framework Result] ⚠️ AI backend returned EMPTY requirements array!`);
        }

        // Ensure requirements in aiResult
        if (Array.isArray(requirements) && reqCount > 0) {
            aiResult.requirements = requirements;
        }

        // Get job metadata
        const job = await prisma.aIJob.findUnique({ where: { providerJobId: jobId } });
        const metadata = job?.metadata ? JSON.parse(job.metadata) : {};

        // Idempotency check
        const frameworkName = metadata.framework_name || aiResult.framework_name || "Generated Framework";
        const existingFramework = await prisma.framework.findFirst({
            where: {
                ...(session.customerAccountId && { customerAccountId: session.customerAccountId }),
                name: frameworkName,
            },
        });

        let saveResult;
        if (existingFramework) {
            console.log(`[Framework Result] Framework already exists: ${existingFramework.id}`);
            saveResult = {
                success: true,
                frameworkId: existingFramework.id,
                framework: existingFramework,
                stats: { message: "Already persisted" }
            };
        } else {
            // Persist to database
            console.log(`[Framework Result] Persisting new framework: "${frameworkName}"`);
            saveResult = await saveFrameworkFromAIResult(aiResult, {
                framework_name: frameworkName,
                description: metadata.description,
                type: metadata.type,
                country: metadata.country,
                industry: metadata.industry,
                code: metadata.code,
            }, session.customerAccountId || "");
        }

        // Update job status
        await aiAuditService.updateJobStatus(jobId, 'COMPLETED');

        console.log(`[Framework Result] ✅ Complete: frameworkId=${saveResult.frameworkId}, time=${Date.now() - startTime}ms`);

        // Log operation
        await aiAuditService.logOperation({
            jobId,
            endpoint,
            method: 'GET',
            responseBody: { success: true, frameworkId: saveResult.frameworkId },
            statusCode: response.status,
            latencyMs: Date.now() - startTime,
            userId: session.id
        });

        return NextResponse.json({ ...aiResult, ...saveResult });

    } catch (error: any) {
        console.error(`[Framework Result] ❌ Error: ${error.message}`, error);

        if (jobId) {
            await aiAuditService.updateJobStatus(jobId, 'FAILED');
        }

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
