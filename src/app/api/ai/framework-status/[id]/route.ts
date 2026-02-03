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
 * 
 * Called automatically every 15 seconds by polling hook.
 * Expected statuses: QUEUED → PROCESSING → COMPLETED
 * 
 * Testing:
 * curl "http://localhost:3000/api/ai/framework-status/{jobId}"
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

        const pollTime = new Date().toISOString();
        console.log(`\n🟡 [${pollTime}] STEP 2/3: STATUS POLL | Job: ${id} | Calling: GET /api/framework_job_status/${id}`);

        // Call Python backend via centralized client
        const response = await aiApiClient.get(endpoint);
        const result = response.data;
        const latency = Date.now() - startTime;

        // Concise status-specific logging
        const statusUpper = (result.status || 'UNKNOWN').toUpperCase();

        if (statusUpper === 'COMPLETED') {
            console.log(`   ✅ RESPONSE: Status=${statusUpper} | Latency=${latency}ms | READY FOR RESULT FETCH → GET /api/ai/framework-result/${id}`);
        } else if (statusUpper === 'PROCESSING') {
            console.log(`   ⏳ RESPONSE: Status=${statusUpper} | Progress=${result.progress || 'N/A'}% | Latency=${latency}ms | Next poll in 15s`);
        } else if (statusUpper === 'QUEUED') {
            console.log(`   ⏳ RESPONSE: Status=${statusUpper} | Queue Position=${result.queue_position || 'N/A'} | Latency=${latency}ms | Next poll in 15s`);
        } else if (statusUpper === 'FAILED') {
            console.log(`   ❌ RESPONSE: Status=${statusUpper} | Error=${result.error || 'Unknown'} | Latency=${latency}ms`);
        } else {
            console.log(`   📊 RESPONSE: Status=${statusUpper} | Latency=${latency}ms`);
        }

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
        const errorTime = new Date().toISOString();
        console.error(`\n❌ [${errorTime}] STATUS POLL FAILED | Job: ${id} | Error: ${error.message || 'Unknown'} | Status: ${error.status || 'N/A'} | Latency: ${Date.now() - startTime}ms`);

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
