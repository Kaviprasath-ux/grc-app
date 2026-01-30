import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";

export async function POST(req: NextRequest) {
    const startTime = Date.now();
    let userId: string | undefined;

    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        userId = session.user.id;

        const formData = await req.formData();

        // Step 1: Log AIOperation (Request)
        await aiAuditService.logOperation({
            endpoint: "/api/semanticMatch_process_asset_riskV2",
            method: "POST",
            requestBody: { type: "SEMANTIC_MATCHING_SUBMISSION" },
            userId,
        });

        // Step 2: Call RunPod via aiApiClient
        // Use URLSearchParams for application/x-www-form-urlencoded
        const params = new URLSearchParams();
        for (const [key, value] of formData.entries()) {
            if (typeof value === "string") {
                params.append(key, value);
            }
        }

        const response = await aiApiClient.post("/api/semanticMatch_process_asset_riskV2", params, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });

        const runpodJobId = response.data.job_id;

        // Step 3: Create AIJob record
        await aiAuditService.createJob({
            providerJobId: runpodJobId,
            type: "SEMANTIC_MATCHING",
            userId,
        });

        const latencyMs = Date.now() - startTime;

        // Step 4: Log AIOperation (Success)
        await aiAuditService.logOperation({
            jobId: runpodJobId,
            endpoint: "/api/semanticMatch_process_asset_riskV2",
            method: "POST",
            responseBody: response.data,
            statusCode: 200,
            latencyMs,
            userId,
        });

        return NextResponse.json(response.data);

    } catch (error: any) {
        const latencyMs = Date.now() - startTime;
        console.error("[AI Semantic Matching Submit] Error:", error);

        await aiAuditService.logOperation({
            endpoint: "/api/semanticMatch_process_asset_riskV2",
            method: "POST",
            error: error.message || "Unknown error",
            statusCode: error.status || 500,
            latencyMs,
            userId,
        });

        return NextResponse.json(
            { error: error.message || "Failed to submit semantic matching job" },
            { status: error.status || 500 }
        );
    }
}
