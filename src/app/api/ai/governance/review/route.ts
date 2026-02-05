import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import aiApiClient from '@/lib/ai-api-client';
import { AI_ENDPOINTS } from '@/lib/ai-endpoints';
import { aiAuditService } from '@/services/ai-audit-service';
import { prisma } from '@/lib/prisma';
import {
  unauthorizedResponse,
  missingFieldResponse,
  notFoundResponse,
  errorResponse,
  parseComplianceData,
  buildComplianceSummary,
  extractGaps,
  extractRecommendations,
  updatePolicyAIStatus,
} from '@/lib/ai-route-helpers';

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
      return unauthorizedResponse();
    }
    userId = session.user.id;

    const body = await req.json();
    const { policyId } = body;

    if (!policyId) {
      return missingFieldResponse('policyId');
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
                        attachments: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!policy) {
      return notFoundResponse('Policy');
    }

    // Map Controls - Use controlQuestion field (the actual question), fallback to description/name
    const grcControls = policy.policyControls.map(pc => ({
      control_code: pc.control.controlCode,
      control_quetion: pc.control.controlQuestion || pc.control.description || pc.control.name,
    }));

    // Validate: Policy must have linked controls for AI review
    if (grcControls.length === 0) {
      console.log(`[Governance Review] ❌ No controls linked to policy`);
      return errorResponse('Policy has no linked controls', 400, {
        details: 'Please link at least one control to this policy before running AI review. Go to the Controls tab and add controls.',
      });
    }

    // Map Evidences (Flat unique list across all controls)
    const evidenceMap = new Map<string, { evidence_code: string; evidence_artifact: string }>();
    policy.policyControls.forEach(pc => {
      pc.control.evidenceControls.forEach(ec => {
        const e = ec.evidence;
        if (!evidenceMap.has(e.id)) {
          const artifactName =
            e.linkedArtifacts?.[0]?.artifact?.fileName ||
            e.attachments?.[0]?.fileName ||
            'no-artifact';
          evidenceMap.set(e.id, {
            evidence_code: e.evidenceCode,
            evidence_artifact: artifactName,
          });
        }
      });
    });

    // Construct the payload for RunPod
    const runpodPayload = {
      user_id: userId,
      doc_type: 'policy',
      policies: [
        {
          policy_name: policy.name,
          policy_code: policy.code || policyId,
          controls: grcControls,
          evidences: Array.from(evidenceMap.values()),
        },
      ],
    };

    // Log AIOperation (Request)
    const operation = await aiAuditService.logOperation({
      endpoint: AI_ENDPOINTS.POLICY_QUERY,
      method: 'POST',
      requestBody: runpodPayload,
      userId,
    });

    console.log(`[Governance Review] Policy: ${policy.code} - ${policy.name}`);
    console.log(`[Governance Review] Controls: ${grcControls.length}, Evidences: ${evidenceMap.size}`);

    // Call RunPod via aiApiClient
    const response = await aiApiClient.post(AI_ENDPOINTS.POLICY_QUERY, runpodPayload);
    const aiData = response.data as {
      controls_response?: Array<{ control_code: string; status: string; answer: string; score?: number }>;
      evidence_response?: unknown[];
      policy_compliant_data?: {
        total_controls?: number;
        total_compliant_controls?: number;
        compliant_percent?: number;
      };
    };

    // Validate response structure
    if (!aiData || !aiData.policy_compliant_data) {
      const validationError = 'Invalid AI response format: missing policy_compliant_data';
      console.error('[Policy Review] Validation failed:', { aiData });

      await aiAuditService.logOperation({
        endpoint: AI_ENDPOINTS.POLICY_QUERY,
        method: 'POST',
        error: validationError,
        statusCode: 502,
        latencyMs: Date.now() - startTime,
        userId,
      });

      return errorResponse(validationError, 502, {
        details: 'AI backend returned unexpected response format',
      });
    }

    // Parse compliance data using helper
    const complianceData = parseComplianceData(aiData);
    const complianceSummary = buildComplianceSummary(complianceData);
    const gaps = extractGaps(complianceData.controlsResponse);
    const recommendations = extractRecommendations(complianceData.controlsResponse);
    const riskScore = complianceData.compliancePercent;

    const latencyMs = Date.now() - startTime;

    console.log(`[Governance Review] Compliance: ${complianceData.compliancePercent}%, Gaps: ${gaps.length}, Recommendations: ${recommendations.length}`);

    // Update AIOperation with response
    if (operation) {
      await prisma.aIOperation.update({
        where: { id: operation.id },
        data: {
          responseBody: JSON.stringify(aiData),
          statusCode: 200,
          latencyMs,
        },
      });
    }

    // Persist to PolicyAIReview
    const latestReview = await prisma.policyAIReview.findFirst({
      where: { policyId, status: 'ingested' },
      orderBy: { createdAt: 'desc' },
    });

    const reviewData = {
      status: 'completed',
      complianceSummary,
      riskScore,
      matchedControls: JSON.stringify(complianceData.controlsResponse),
      gaps: JSON.stringify(gaps),
      recommendations: JSON.stringify(recommendations),
      reviewedAt: new Date(),
      aiOperationId: operation?.id,
    };

    if (latestReview) {
      await prisma.policyAIReview.update({
        where: { id: latestReview.id },
        data: reviewData,
      });
    } else {
      await prisma.policyAIReview.create({
        data: { policyId, ...reviewData },
      });
    }

    // Update Master Policy Status
    await updatePolicyAIStatus(policyId, {
      status: 'Published',
      aiReviewStatus: 'Completed',
      aiReviewScore: riskScore,
      aiReviewJustification: complianceSummary,
    });

    console.log(`[Governance Review] ✓ Complete in ${latencyMs}ms - Compliance: ${complianceData.compliancePercent}%`);

    // Return enriched response
    return NextResponse.json({
      success: true,
      compliance_score: riskScore,
      compliance_summary: complianceSummary,
      total_controls: complianceData.totalControls,
      compliant_controls: complianceData.compliantControls,
      gaps,
      recommendations,
      raw_response: aiData,
    });
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    const err = error as { message?: string; rawResponse?: string; status?: number; data?: unknown };

    console.error(`[Governance Review] ❌ Error after ${latencyMs}ms:`, err.message);

    await aiAuditService.logOperation({
      endpoint: AI_ENDPOINTS.POLICY_QUERY,
      method: 'POST',
      error: err.message || 'Unknown error during review',
      statusCode: err.status || 500,
      latencyMs,
      userId,
    });

    return errorResponse(err.message || 'Failed to perform policy review', err.status || 500, {
      details: err.rawResponse?.substring(0, 200) || (err.data ? JSON.stringify(err.data).substring(0, 200) : undefined),
    });
  }
}
