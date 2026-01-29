import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";

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

        // Call RunPod result endpoint
        const response = await aiApiClient.get(`/api/semanticMatch_process_asset_riskV2_result/${runpodJobId}`);

        const latencyMs = Date.now() - startTime;

        // Log AIOperation (Final Result)
        await aiAuditService.logOperation({
            jobId: runpodJobId,
            endpoint: `/api/semanticMatch_process_asset_riskV2_result/${runpodJobId}`,
            method: "GET",
            responseBody: response.data,
            statusCode: 200,
            latencyMs,
            userId,
        });

        // Finalize Job status
        await aiAuditService.updateJobStatus(runpodJobId, "COMPLETED");

        return NextResponse.json(response.data);

    } catch (error: any) {
        const latencyMs = Date.now() - startTime;
        console.error(`[AI Semantic Matching Result] Error for job ${runpodJobId}:`, error);

        await aiAuditService.logOperation({
            jobId: runpodJobId,
            endpoint: `/api/semanticMatch_process_asset_riskV2_result/${runpodJobId}`,
            method: "GET",
            error: error.message || "Unknown error",
            statusCode: error.status || 500,
            latencyMs,
            userId,
        });

        return NextResponse.json(
            { error: error.message || "Failed to get job result" },
            { status: error.status || 500 }
        );
    }
}
