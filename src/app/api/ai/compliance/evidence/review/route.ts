import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/ai/compliance/evidence/review
 * 
 * Performs an AI-powered critique of evidence artifacts against their controls.
 * Uses RunPod /api/grc_evidence_query.
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
        const { evidenceId } = body;

        if (!evidenceId) {
            return NextResponse.json({ error: "evidenceId is required" }, { status: 400 });
        }

        // Load Evidence with linked data (Artifacts/Controls)
        const evidence = await prisma.evidence.findUnique({
            where: { id: evidenceId },
            include: {
                linkedArtifacts: { include: { artifact: true } },
                evidenceControls: { include: { control: true } }
            }
        });

        if (!evidence) {
            return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
        }

        // Prepare RunPod Payload (grc_evidencePayLoad)
        // evidences: Array of { evidence_code: string, evidence_artifact: string }
        const evidencesPayload = evidence.linkedArtifacts.map(la => ({
            evidence_code: evidence.evidenceCode,
            evidence_artifact: la.artifact.fileName // Using fileName as identifier for backend context
        }));

        const runpodPayload = {
            user_id: userId,
            evidence_id: evidenceId,
            doc_type: "evidence",
            evidences: evidencesPayload
        };

        // Step 1: Log AIOperation (Request)
        const operation = await aiAuditService.logOperation({
            endpoint: "/api/grc_evidence_query",
            method: "POST",
            requestBody: runpodPayload,
            userId,
        });

        console.log(`[Evidence Review] Querying RunPod for evidence ${evidenceId}`);

        // Step 2: Call RunPod via aiApiClient
        const response = await aiApiClient.post("/api/grc_evidence_query", runpodPayload);

        // Expected Response: { critique: "...", similarity_score: 0.85, recommendations: [...] }
        const aiData = response.data;
        const latencyMs = Date.now() - startTime;

        // Step 3: Log AIOperation (Success Result)
        if (operation) {
            await prisma.aIOperation.update({
                where: { id: operation.id },
                data: {
                    responseBody: JSON.stringify(aiData),
                    statusCode: 200,
                    latencyMs,
                }
            });
        }

        // Step 4: Persist to EvidenceAIReview (Domain Persistence)
        const aiReview = await prisma.evidenceAIReview.create({
            data: {
                evidenceId,
                status: "completed",
                critique: aiData.critique,
                similarityScore: aiData.similarity_score,
                recommendations: JSON.stringify(aiData.recommendations || []),
                aiOperationId: operation?.id,
            }
        });

        // Step 5: Update Master Evidence Status (Business logic)
        await prisma.evidence.update({
            where: { id: evidenceId },
            data: {
                status: aiData.similarity_score > 0.7 ? "Validated" : "Need Attention",
                reviewDate: new Date(),
            }
        });

        return NextResponse.json({
            success: true,
            reviewId: aiReview.id,
            result: aiData
        });

    } catch (error: any) {
        const latencyMs = Date.now() - startTime;
        console.error("[Evidence Review] Error:", error);

        // Log Error Operation
        await aiAuditService.logOperation({
            endpoint: "/api/grc_evidence_query",
            method: "POST",
            error: error.message || "Unknown error during evidence review",
            statusCode: error.status || 500,
            latencyMs,
            userId,
        });

        return NextResponse.json(
            { error: error.message || "Failed to perform evidence review" },
            { status: error.status || 500 }
        );
    }
}
