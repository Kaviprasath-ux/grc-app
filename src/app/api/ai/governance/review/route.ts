import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import aiApiClient from "@/lib/ai-api-client";
import { aiAuditService } from "@/services/ai-audit-service";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/ai/governance/review
 * 
 * Performs an AI-powered policy review.
 * Fully aligned with RunPod /api/grc_policy_query OpenAPI contract.
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

        // Load Policy with full nested context (Controls and linked Evidences)
        const policy = await prisma.policy.findUnique({
            where: { id: policyId },
            include: {
                policyControls: {
                    include: {
                        control: {
                            include: {
                                evidenceControls: {
                                    include: {
                                        evidence: {
                                            include: {
                                                linkedArtifacts: { include: { artifact: true } }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
            }
        });

        if (!policy) {
            return NextResponse.json({ error: "Policy not found" }, { status: 404 });
        }

        // --- OpenAPI Canonical Payload Prep ---

        // 1. Map Controls
        const grcControls = policy.policyControls.map(pc => ({
            control_code: pc.control.controlCode,
            control_quetion: pc.control.description || pc.control.name // Map description to question for context
        }));

        // 2. Map Evidences (Flat unique list across all controls)
        const evidenceMap = new Map();
        policy.policyControls.forEach(pc => {
            pc.control.evidenceControls.forEach(ec => {
                const e = ec.evidence;
                if (!evidenceMap.has(e.id)) {
                    evidenceMap.set(e.id, {
                        evidence_code: e.evidenceCode,
                        evidence_artifact: e.linkedArtifacts?.[0]?.artifact?.fileName || "no-artifact"
                    });
                }
            });
        });

        // 3. Construct the 'policies' array required by RunPod
        const policiesPayload = [{
            policy_name: policy.name,
            policy_code: policy.code || policyId,
            controls: grcControls,
            evidences: Array.from(evidenceMap.values())
        }];

        const runpodPayload = {
            user_id: userId,
            doc_type: "policy",
            policies: policiesPayload
        };

        // Step 1: Log AIOperation (Request) - Atomic Hook Pattern
        const operation = await aiAuditService.logOperation({
            endpoint: "/api/grc_policy_query",
            method: "POST",
            requestBody: runpodPayload,
            userId,
        });

        console.log(`[Governance Review] Syncing Policy Review for ${policy.code} (Contract OK)`);

        // Step 2: Call RunPod via aiApiClient
        const response = await aiApiClient.post("/api/grc_policy_query", runpodPayload);

        const aiData = response.data;

        // WARNING FIX: Validate AI response structure to prevent database constraint violations
        const hasSummary = typeof aiData.compliance_summary === 'string' || typeof aiData.summary === 'string';
        if (!aiData || typeof aiData.risk_score !== 'number' || !hasSummary) {
            const validationError = 'Invalid AI response format: missing or malformed required fields';
            console.error('[Policy Review] Validation failed:', { aiData });

            await aiAuditService.logOperation({
                endpoint: "/api/grc_policy_query",
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

        // Step 3: Log AIOperation (Success Update)
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

        // Step 4: Persist to PolicyAIReview (Domain Persistence)
        // Find existing review or create new completion record
        const latestReview = await prisma.policyAIReview.findFirst({
            where: { policyId, status: "ingested" },
            orderBy: { createdAt: "desc" }
        });

        if (latestReview) {
            await prisma.policyAIReview.update({
                where: { id: latestReview.id },
                data: {
                    status: "completed",
                    complianceSummary: aiData.compliance_summary || aiData.summary,
                    riskScore: aiData.risk_score,
                    matchedControls: JSON.stringify(aiData.matched_controls || []),
                    gaps: JSON.stringify(aiData.gaps || []),
                    recommendations: JSON.stringify(aiData.recommendations || []),
                    reviewedAt: new Date(),
                    aiOperationId: operation?.id
                }
            });
        }

        // Step 5: Update Master Policy Status
        await prisma.policy.update({
            where: { id: policyId },
            data: {
                status: "Published",
                aiReviewStatus: "Completed",
                aiReviewScore: aiData.risk_score,
                aiReviewJustification: aiData.compliance_summary || aiData.summary,
            }
        });

        return NextResponse.json(aiData);

    } catch (error: any) {
        const latencyMs = Date.now() - startTime;
        console.error("[Governance Review] Error:", error);

        await aiAuditService.logOperation({
            endpoint: "/api/grc_policy_query",
            method: "POST",
            error: error.message || "Unknown error during review",
            statusCode: error.status || 500,
            latencyMs,
            userId,
        });

        return NextResponse.json(
            { error: error.message || "Failed to perform policy review" },
            { status: error.status || 500 }
        );
    }
}
