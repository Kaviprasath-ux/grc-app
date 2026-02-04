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
                                                linkedArtifacts: { include: { artifact: true } },
                                                attachments: true // Include direct file attachments
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

        // 1. Map Controls - Use controlQuestion field (the actual question), fallback to description/name
        const grcControls = policy.policyControls.map(pc => ({
            control_code: pc.control.controlCode,
            control_quetion: pc.control.controlQuestion || pc.control.description || pc.control.name
        }));

        // 2. Map Evidences (Flat unique list across all controls)
        // Check both linkedArtifacts (Artifact table) and attachments (direct file uploads)
        const evidenceMap = new Map();
        policy.policyControls.forEach(pc => {
            pc.control.evidenceControls.forEach(ec => {
                const e = ec.evidence;
                if (!evidenceMap.has(e.id)) {
                    // Get artifact from linkedArtifacts first, fallback to direct attachments
                    const artifactName = e.linkedArtifacts?.[0]?.artifact?.fileName
                        || e.attachments?.[0]?.fileName
                        || "no-artifact";
                    evidenceMap.set(e.id, {
                        evidence_code: e.evidenceCode,
                        evidence_artifact: artifactName
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

        console.log(`[Governance Review] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`[Governance Review] Policy: ${policy.code} - ${policy.name}`);
        console.log(`[Governance Review] Controls: ${grcControls.length}, Evidences: ${evidenceMap.size}`);

        // Validate: Policy must have linked controls for AI review
        if (grcControls.length === 0) {
            console.log(`[Governance Review] ❌ No controls linked to policy`);
            return NextResponse.json(
                {
                    error: "Policy has no linked controls",
                    message: "Please link at least one control to this policy before running AI review. Go to the Controls tab and add controls.",
                },
                { status: 400 }
            );
        }

        console.log(`[Governance Review] Payload:`, JSON.stringify(runpodPayload, null, 2));

        // Step 2: Call RunPod via aiApiClient
        console.log(`[Governance Review] Calling RunPod /api/grc_policy_query...`);
        const response = await aiApiClient.post("/api/grc_policy_query", runpodPayload);

        const aiData = response.data;
        console.log(`[Governance Review] ✓ Response received:`, JSON.stringify(aiData).substring(0, 500));

        // Parse the actual RunPod response format:
        // { controls_response: [...], evidence_response: [...], policy_compliant_data: { total_controls, total_compliant_controls, compliant_percent } }
        const controlsResponse = aiData.controls_response || [];
        // evidenceResponse available for future use: aiData.evidence_response || []
        const policyData = aiData.policy_compliant_data || {};

        // Validate response structure
        if (!aiData || !policyData) {
            const validationError = 'Invalid AI response format: missing policy_compliant_data';
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

        // Extract compliance metrics
        const compliancePercent = policyData.compliant_percent ?? 0;
        const totalControls = policyData.total_controls ?? 0;
        const compliantControls = policyData.total_compliant_controls ?? 0;

        // Map to risk score (0-100 where higher = more compliant)
        const riskScore = compliancePercent;

        // Build compliance summary from controls_response
        const nonCompliantItems = controlsResponse.filter((c: any) => c.status !== 'compliant');

        const complianceSummary = `Policy review completed. ${compliantControls}/${totalControls} controls compliant (${compliancePercent}%). ` +
            (nonCompliantItems.length > 0
                ? `Non-compliant: ${nonCompliantItems.map((c: any) => c.control_code).join(', ')}`
                : 'All controls are compliant.');

        // Extract gaps from non-compliant controls
        const gaps = nonCompliantItems.map((c: any) => ({
            control_code: c.control_code,
            status: c.status,
            answer: c.answer,
            score: c.score
        }));

        // Extract recommendations from answers
        const recommendations = controlsResponse
            .filter((c: any) => c.answer && c.answer !== 'No relevant results found.')
            .map((c: any) => ({
                control_code: c.control_code,
                recommendation: c.answer
            }));

        console.log(`[Governance Review] Compliance: ${compliancePercent}%, Gaps: ${gaps.length}, Recommendations: ${recommendations.length}`);

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
                    complianceSummary: complianceSummary,
                    riskScore: riskScore,
                    matchedControls: JSON.stringify(controlsResponse),
                    gaps: JSON.stringify(gaps),
                    recommendations: JSON.stringify(recommendations),
                    reviewedAt: new Date(),
                    aiOperationId: operation?.id
                }
            });
        } else {
            // Create new review if none exists
            await prisma.policyAIReview.create({
                data: {
                    policyId,
                    status: "completed",
                    complianceSummary: complianceSummary,
                    riskScore: riskScore,
                    matchedControls: JSON.stringify(controlsResponse),
                    gaps: JSON.stringify(gaps),
                    recommendations: JSON.stringify(recommendations),
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
                aiReviewScore: riskScore,
                aiReviewJustification: complianceSummary,
            }
        });

        console.log(`[Governance Review] ✓ Complete in ${latencyMs}ms - Compliance: ${compliancePercent}%`);
        console.log(`[Governance Review] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        // Return enriched response
        return NextResponse.json({
            success: true,
            compliance_score: riskScore,
            compliance_summary: complianceSummary,
            total_controls: totalControls,
            compliant_controls: compliantControls,
            gaps: gaps,
            recommendations: recommendations,
            raw_response: aiData
        });

    } catch (error: any) {
        const latencyMs = Date.now() - startTime;
        console.error(`[Governance Review] ❌ Error after ${latencyMs}ms:`);
        console.error(`[Governance Review] Status: ${error.status || 'N/A'}`);
        console.error(`[Governance Review] Message: ${error.message || 'Unknown'}`);
        if (error.rawResponse) {
            console.error(`[Governance Review] Raw Response: ${error.rawResponse.substring(0, 500)}`);
        }
        if (error.data) {
            console.error(`[Governance Review] Data:`, JSON.stringify(error.data).substring(0, 500));
        }

        await aiAuditService.logOperation({
            endpoint: "/api/grc_policy_query",
            method: "POST",
            error: error.message || "Unknown error during review",
            statusCode: error.status || 500,
            latencyMs,
            userId,
        });

        return NextResponse.json(
            {
                error: error.message || "Failed to perform policy review",
                details: error.rawResponse?.substring(0, 200) || error.data || undefined
            },
            { status: error.status || 500 }
        );
    }
}
