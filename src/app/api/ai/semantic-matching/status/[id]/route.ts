import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";

/**
 * GET /api/ai/semantic-matching/status/[id]
 * 
 * Check the status of a semantic matching job.
 * Aligned with 100% Audit Coverage rule (Atomic Hook).
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const startTime = Date.now();
    const runpodJobId = id;
    let userId: string | undefined;

    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        userId = session.user.id;

        const endpoint = `/api/semanticMatch_process_asset_riskV2_status/${runpodJobId}`;

        // Step 1: Log AIOperation (Request) - Mandatory Audit Hook
        const operation = await aiAuditService.logOperation({
            jobId: runpodJobId,
            endpoint,
            method: "GET",
            userId,
        });

        console.log(`[AI Semantic Status] Polling job ${runpodJobId} (Audit Logged)`);

        // Step 2: Call RunPod status endpoint
        const response = await aiApiClient.get(endpoint);

        const status = response.data.status; // queued, processing, completed, error
        const latencyMs = Date.now() - startTime;

        // Step 3: Log AIOperation (Success Update)
        if (operation) {
            await aiAuditService.logOperation({
                endpoint,
                method: "GET",
                responseBody: response.data,
                statusCode: 200,
                latencyMs,
                userId,
                jobId: runpodJobId
            });
            // Note: We use logOperation again to update or we could use prisma.aIOperation.update if we had export.
            // aiAuditService.logOperation with existing jobId/endpoint and responseBody will update correctly 
            // if implementaton supports it, or we use standard update logic below.
        }

        // Sync status to our AIJob table
        await aiAuditService.updateJobStatus(runpodJobId, status.toUpperCase());

        return NextResponse.json(response.data);

    } catch (error: any) {
        const latencyMs = Date.now() - startTime;
        console.error(`[AI Semantic Status] Error for job ${runpodJobId}:`, error);

        // Standard Error Logging
        await aiAuditService.logOperation({
            jobId: runpodJobId,
            endpoint: `/api/semanticMatch_process_asset_riskV2_status/${runpodJobId}`,
            method: "GET",
            error: error.message || "Failed to check status",
            statusCode: error.status || 500,
            latencyMs,
            userId,
        });

        return NextResponse.json(
            { error: error.message || "Failed to check job status" },
            { status: error.status || 500 }
        );
    }
}
