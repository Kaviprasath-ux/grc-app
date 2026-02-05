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
        console.log(`
╔════════════════════════════════════════════════════════════════╗
║          🟡 STEP 2/3: POLLING FOR STATUS                        ║
║          GET /api/ai/framework-status/{jobId}                  ║
╚════════════════════════════════════════════════════════════════╝
[${pollTime}]

📋 POLL REQUEST:
  Job ID            : ${id}
  User ID           : ${session.id}
  Endpoint Called   : GET /api/framework_job_status/${id}
  
⏳ Querying Python backend for status...
`);

        // Call Python backend via centralized client
        const response = await aiApiClient.get(endpoint);
        const result = response.data;
        const latency = Date.now() - startTime;

        console.log(`
✅ STATUS RECEIVED FROM PYTHON BACKEND
[${new Date().toISOString()}]

📊 POLL RESPONSE:
  Job ID            : ${id}
  Status            : ${(result.status || 'UNKNOWN').toUpperCase()}
  Response Time     : ${latency}ms
  Progress          : ${result.progress || 'N/A'}%
  
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

        // Status-specific logging
        if (result.status === 'completed' || result.status === 'COMPLETED') {
            console.log(`
✅ JOB COMPLETED!
  Status            : READY FOR RETRIEVAL
  Next Step         : GET /api/ai/framework-result/${id}
  Action            : Will fetch results & persist to DB
  
  Test Command:
  curl "http://localhost:3000/api/ai/framework-result/${id}" \\
    -H "Authorization: Bearer YOUR_TOKEN"
`);
        } else if (result.status === 'processing' || result.status === 'PROCESSING') {
            console.log(`
⏳ JOB PROCESSING
  Status            : IN PROGRESS
  Progress          : ${result.progress || 'N/A'}%
  Next Poll         : In 15 seconds
  Keep polling...
`);
        } else if (result.status === 'queued' || result.status === 'QUEUED') {
            console.log(`
⏳ JOB QUEUED
  Status            : WAITING TO START
  Position          : ${result.queue_position || 'N/A'}
  Next Poll         : In 15 seconds
  Keep polling...
`);
        } else if (['failed', 'FAILED', 'error', 'ERROR'].includes(result.status)) {
            console.log(`
❌ JOB FAILED / ERROR
  Status            : ${result.status}
  Error             : ${result.error || 'Unknown error'}
  Error Code        : ${result.error_code || 'N/A'}
  Message           : ${result.error_message || result.message || 'No message'}
  Detail            : ${JSON.stringify(result.detail || result)}
  
  Action Required   : Review error and retry. Check RunPod/Python backend logs.
`);
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
        console.error(`
╔════════════════════════════════════════════════════════════════╗
║          ❌ FRAMEWORK STATUS POLLING FAILED                     ║
╚════════════════════════════════════════════════════════════════╝
[${errorTime}]

📊 ERROR DETAILS:
  • Job ID: ${id}
  • Message: ${error.message || 'Unknown error'}
  • Status Code: ${error.status || 'N/A'}
  • Processing Time: ${Date.now() - startTime}ms

🔧 TROUBLESHOOTING:
  • Verify job ID: ${id}
  • Check backend connectivity
  • Retry polling in a few seconds
`);

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
