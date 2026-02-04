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

        // Load Evidence with attachments (ingested files) and controls
        const evidence = await prisma.evidence.findUnique({
            where: { id: evidenceId },
            include: {
                attachments: {
                    select: {
                        id: true,
                        fileName: true,
                    },
                    orderBy: { uploadedAt: "desc" },
                },
                evidenceControls: { include: { control: true } }
            }
        });

        if (!evidence) {
            return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
        }

        // DEPENDENCY CHECK: Ensure related document has been ingested
        // Check if there's a completed ingest job for this evidence
        const relatedIngestJob = await prisma.aIJob.findFirst({
            where: {
                type: 'GRC_INGEST',
                metadata: {
                    contains: evidenceId
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!relatedIngestJob) {
            return NextResponse.json({
                error: "Document must be ingested before review",
                message: "Please ingest the related document first using the ingest endpoint."
            }, { status: 400 });
        }

        if (relatedIngestJob.status !== 'COMPLETED') {
            return NextResponse.json({
                error: "Document ingestion not complete",
                message: `Ingestion status: ${relatedIngestJob.status}. Please wait for ingestion to complete.`,
                jobId: relatedIngestJob.providerJobId,
                status: relatedIngestJob.status
            }, { status: 400 });
        }

        // Prepare RunPod Payload (grc_evidencePayLoad)
        // Use attachments (ingested files) for evidence_artifact - these match what was ingested
        const evidencesPayload = [{
            evidence_code: evidence.evidenceCode,
            evidence_artifact: evidence.attachments
                .map(att => att.fileName)
                .join(", ") || evidence.evidenceCode
        }];

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

        // WARNING FIX: Validate AI response structure to prevent database constraint violations
        if (!aiData || typeof aiData.similarity_score !== 'number' || typeof aiData.critique !== 'string') {
            const validationError = 'Invalid AI response format: missing or malformed required fields';
            console.error('[Evidence Review] Validation failed:', { aiData });

            await aiAuditService.logOperation({
                endpoint: "/api/grc_evidence_query",
                method: "POST",
                error: validationError,
                statusCode: 502,
                latencyMs: Date.now() - startTime,
                userId,
            });

            return NextResponse.json(
                { error: validationError, details: 'AI backend returned unexpected response format' },
                { status: 502 }
            );
        }

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
                status: aiData.similarity_score > 0.7 ? "Published" : "Need Attention",
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
