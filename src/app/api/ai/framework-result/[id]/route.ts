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

        const retrievalTime = new Date().toISOString();
        console.log(`
╔════════════════════════════════════════════════════════════════╗
║          🟢 FRAMEWORK GENERATION RESULT RETRIEVAL               ║
╚════════════════════════════════════════════════════════════════╝
[${retrievalTime}] GET /api/ai/framework-result/${id}

📊 REQUEST:
  • Job ID: ${id}
  • User ID: ${session.id}

⏱️  Fetching results from backend...
`);

        // Call Python backend
        const response = await aiApiClient.get(endpoint);
        const aiResult = response.data;

        console.log(`
📋 FRAMEWORK DATA RECEIVED FROM AI BACKEND
[${new Date().toISOString()}]

📊 AI RESULT SUMMARY:
  • Framework Name: ${aiResult.framework_name || 'N/A'}
  • Framework Code: ${aiResult.framework_code || 'N/A'}
  • Total Requirements: ${aiResult.total_requirements || 0}
  • Response Time: ${Date.now() - startTime}ms
`);

        // SERVER-SIDE PERSISTENCE (Target State Implementation)
        // 1. Retrieve job metadata
        console.log(`
💾 DATABASE PERSISTENCE STARTING
[${new Date().toISOString()}]

🔍 STEP 1: Retrieving job metadata...`);

        const job = await prisma.aIJob.findUnique({
            where: { providerJobId: id }
        });

        if (!job) {
            console.warn(`  ⚠️  AIJob record not found for ${id}. Persistence may be limited.`);
        } else {
            console.log(`  ✅ AIJob found: ${job.id}`);
        }

        const metadata = job?.metadata ? JSON.parse(job.metadata) : {};

        // 2. IDEMPOTENCY CHECK: Ensure framework is not persisted twice
        // If result endpoint is called twice (due to network retry), skip persistence
        console.log(`
🔍 STEP 2A: Checking if framework already persisted (idempotency)...`);

        const existingFramework = await prisma.framework.findFirst({
            where: {
                ...(session.customerAccountId && { customerAccountId: session.customerAccountId }),
                name: metadata.framework_name || aiResult.framework_name || "Generated Framework",
            },
        });

        let saveResult;
        if (existingFramework) {
            console.log(`
⚠️  FRAMEWORK ALREADY PERSISTED
[${new Date().toISOString()}]

  • Framework ID: ${existingFramework.id}
  • Name: ${existingFramework.name}

✅ Idempotency check: Returning existing framework instead of creating duplicate
`);

            saveResult = {
                success: true,
                frameworkId: existingFramework.id,
                framework: existingFramework,
                stats: {
                    requirementCount: 0,
                    categoryCount: 0,
                    controlCount: 0,
                    message: "Framework already persisted from previous call"
                }
            };
        } else {
            // 2. Persist to domain tables (only if not already persisted)
            console.log(`
🔍 STEP 2B: Persisting framework hierarchy to database...
  • Creating Framework record
  • Creating Requirement categories
  • Creating Requirement records
  • Creating Control records
  • Linking relationships
`);

            saveResult = await saveFrameworkFromAIResult(aiResult, {
                framework_name: metadata.framework_name || aiResult.framework_name || "Generated Framework",
                description: metadata.description || undefined,
                type: metadata.type || undefined,
                country: metadata.country || undefined,
                industry: metadata.industry || undefined,
                code: metadata.code || undefined,
            }, session.customerAccountId || "");
        }

        console.log(`
✅ DATABASE PERSISTENCE COMPLETE
[${new Date().toISOString()}]

📊 PERSISTENCE RESULT:
  • Framework ID: ${saveResult.frameworkId}
  • Status: ${saveResult.success ? 'SUCCESS' : 'FAILED'}
`);

        // 3. Mark job as COMPLETED
        console.log(`
🔍 STEP 3: Updating job status to COMPLETED...`);

        await aiAuditService.updateJobStatus(id, 'COMPLETED');
        console.log(`  ✅ Job status updated\n`);

        console.log(`
╔════════════════════════════════════════════════════════════════╗
║               ✅ FRAMEWORK GENERATION COMPLETE                  ║
╚════════════════════════════════════════════════════════════════╝
[${new Date().toISOString()}]

📊 FINAL SUMMARY:
  • Job ID: ${id}
  • Status: COMPLETED
  • Framework ID: ${saveResult.frameworkId}
  • Requirements: ${aiResult.total_requirements || 0}
  • Total Processing Time: ${Date.now() - startTime}ms

🎉 Framework is now available in the database!
`);

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
            ...aiResult,
            ...saveResult
        });
    } catch (error: any) {
        const errorTime = new Date().toISOString();
        console.error(`
╔════════════════════════════════════════════════════════════════╗
║          ❌ FRAMEWORK RESULT RETRIEVAL FAILED                   ║
╚════════════════════════════════════════════════════════════════╝
[${errorTime}]

📊 ERROR DETAILS:
  • Job ID: ${id}
  • Message: ${error.message || 'Unknown error'}
  • Status Code: ${error.status || 'N/A'}
  • Processing Time: ${Date.now() - startTime}ms

🔧 TROUBLESHOOTING:
  • Verify job ID: ${id}
  • Check job status is COMPLETED
  • Check backend logs for framework data
  • Verify database connectivity
`);

        const statusCode = error.status || 500;
        const errorMsg = error.message || "Internal server error";

        // Update job status to FAILED if it was in the DB
        if (id) {
            console.log(`  • Marking job as FAILED in database...`);
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
