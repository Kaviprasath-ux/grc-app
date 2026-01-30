import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/ai/governance/cleanup
 * 
 * Cleans up AI-processed documents for a policy.
 * Fully aligned with RunPod /api/grc_delete OpenAPI contract.
 */
export async function POST(req: NextRequest) {
    const startTime = Date.now();
    let userId: string | undefined;

    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        userId = session.user.id;

        const body = await req.json();
        const { policyId } = body;

        if (!policyId) {
            return NextResponse.json({ error: "policyId is required" }, { status: 400 });
        }

        // Fetch policy details for canonical metadata
        const policy = await prisma.policy.findUnique({
            where: { id: policyId }
        });

        if (!policy) {
            return NextResponse.json({ error: "Policy not found" }, { status: 404 });
        }

        // Step 1: Find all AI reviews with documentIds
        const reviews = await prisma.policyAIReview.findMany({
            where: {
                policyId,
                documentId: { not: null }
            }
        });

        console.log(`[Governance Cleanup] Cleaning up ${reviews.length} AI docs for ${policy.policyCode} (Contract Sync)`);

        const results: any[] = [];

        // Step 2: Loop through and delete from RunPod
        for (const review of reviews) {
            if (!review.documentId) continue;

            const opStartTime = Date.now();
            const runpodPayload = {
                base_id: policyId,
                doc_type: "policy",
                document_id: review.documentId,
                file_name: policy.policyCode || "policy-doc"
            };

            try {
                // Log AIOperation (Request) - Standard Atomic Hook
                const operation = await aiAuditService.logOperation({
                    endpoint: "/api/grc_delete",
                    method: "POST",
                    requestBody: runpodPayload,
                    userId,
                });

                // Call RunPod grc_delete
                const response = await aiApiClient.post("/api/grc_delete", runpodPayload);

                // Log AIOperation (Success Update)
                if (operation) {
                    await prisma.aIOperation.update({
                        where: { id: operation.id },
                        data: {
                            responseBody: JSON.stringify(response.data),
                            statusCode: 200,
                            latencyMs: Date.now() - opStartTime,
                        }
                    });
                }

                results.push({ documentId: review.documentId, status: "deleted" });

            } catch (error: any) {
                console.error(`[Governance Cleanup] Failed to delete document ${review.documentId}:`, error);

                // Standardized Error Logging
                await aiAuditService.logOperation({
                    endpoint: "/api/grc_delete",
                    method: "POST",
                    error: error.message || "Delete failed",
                    statusCode: error.status || 500,
                    latencyMs: Date.now() - opStartTime,
                    userId,
                });

                results.push({ documentId: review.documentId, status: "failed", error: error.message });
            }
        }

        // Step 3: Delete database records
        await prisma.policyAIReview.deleteMany({
            where: { policyId }
        });

        // Reset Policy AI status
        await prisma.policy.update({
            where: { id: policyId },
            data: {
                aiReviewStatus: "Pending",
                aiReviewScore: 0,
                aiReviewJustification: null,
            }
        });

        return NextResponse.json({
            success: true,
            cleanupDetails: results
        });

    } catch (error: any) {
        const latencyMs = Date.now() - startTime;
        console.error("[Governance Cleanup] Global Error:", error);

        return NextResponse.json(
            { error: error.message || "Failed to perform policy cleanup" },
            { status: error.status || 500 }
        );
    }
}
