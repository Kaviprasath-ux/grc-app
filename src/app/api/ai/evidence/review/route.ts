import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, validateTenantAccess, forbidden } from '@/lib/api-auth';
import aiApiClient from '@/lib/ai-api-client';
import { AI_ENDPOINTS } from '@/lib/ai-endpoints';
import {
  missingFieldResponse,
  notFoundResponse,
  errorResponse,
  buildEvidencePayload,
  createAIOperation,
  updateAIOperation,
  isIngestComplete,
  updateEvidenceAIStatus,
  parseComplianceData,
  buildComplianceSummary,
  extractGaps,
  extractRecommendations,
} from '@/lib/ai-route-helpers';

interface RequestBody {
  evidenceId: string;
}

/**
 * POST /api/ai/evidence/review
 * Trigger AI review for ingested evidence
 * Calls RunPod /api/grc_evidence_query
 */
export const POST = withAuth(
  async (req: NextRequest, _context, session) => {
    const startTime = Date.now();

    try {
      const body: RequestBody = await req.json();
      const { evidenceId } = body;

      if (!evidenceId) {
        return missingFieldResponse('evidenceId');
      }

      // Verify evidence exists and user has access
      const evidence = await prisma.evidence.findUnique({
        where: { id: evidenceId },
        select: {
          id: true,
          evidenceCode: true,
          description: true,
          customerAccountId: true,
          aiIngestStatus: true,
          attachments: {
            select: { fileName: true },
            orderBy: { uploadedAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!evidence) {
        return notFoundResponse('Evidence');
      }

      if (!validateTenantAccess(session, evidence.customerAccountId)) {
        return forbidden('Access denied to this evidence');
      }

      // Verify evidence has been ingested
      if (!isIngestComplete(evidence.aiIngestStatus)) {
        return errorResponse(
          `Evidence must be ingested first. Current status: ${evidence.aiIngestStatus || 'NOT_STARTED'}`,
          400
        );
      }

      // Update evidence review status to IN_PROGRESS
      await updateEvidenceAIStatus(evidenceId, { reviewStatus: 'IN_PROGRESS' });

      // Build AI query payload
      // IMPORTANT: Use customerAccountId (not session.id) to match base_id from ingest
      const requestBody = buildEvidencePayload(evidence, evidence.customerAccountId);

      // Create AI operation record
      const aiOperation = await createAIOperation({
        endpoint: AI_ENDPOINTS.EVIDENCE_QUERY,
        method: 'POST',
        requestBody,
        userId: session.id,
      });

      // Call RunPod evidence query endpoint
      let response;
      try {
        response = await aiApiClient.post(AI_ENDPOINTS.EVIDENCE_QUERY, requestBody);
      } catch (apiError: unknown) {
        const err = apiError as { message?: string; rawResponse?: string; requestId?: string; status?: number };
        console.error('[Evidence Review] RunPod API failed:', err);

        // Update evidence review status to failed
        await updateEvidenceAIStatus(evidenceId, { reviewStatus: 'FAILED' });

        return errorResponse('AI review failed', err.status || 502, {
          details: err.rawResponse?.substring(0, 200) || err.message,
          requestId: err.requestId,
        });
      }

      const runpodRaw = response.data;

      // Update AI operation with response
      await updateAIOperation(aiOperation.id, {
        data: runpodRaw,
        status: response.status,
        latencyMs: Date.now() - startTime,
      });

      // Define type for review items from RunPod evidence query
      interface ReviewItem {
        status_code?: number;
        question?: string;
        control_code?: string;
        answer?: string;
        score?: number | null;
        status?: string;
        uuid?: string;
        Issue?: string;
        Risk?: string;
        Severity?: string;
      }

      // Process the RunPod response - handle array, governance-style, and direct-field formats
      let complianceSummary: string | null = null;
      let complianceScore: number | null = null;
      let gaps: unknown[] | null = null;
      let suggestions: unknown[] | null = null;
      let critique: string | null = null;
      let rawResponseArray: unknown[] | null = null;
      let recommendations: unknown[] | null = null;

      if (Array.isArray(runpodRaw)) {
        // Array response format: [{ control_code, question, answer, status, Severity, ... }]
        const reviewItems = runpodRaw as ReviewItem[];
        rawResponseArray = reviewItems;

        // Extract non-compliant items as gaps
        const nonCompliant = reviewItems.filter(
          (item) => item.status && item.status.toLowerCase() !== 'compliant'
        );
        const totalItems = reviewItems.length;
        const compliantCount = totalItems - nonCompliant.length;
        const compliancePercent = totalItems > 0 ? Math.round((compliantCount / totalItems) * 100) : 0;

        complianceScore = compliancePercent;
        critique = compliancePercent >= 80 ? 'compliant' : 'non-compliant';
        complianceSummary = `Evidence review completed. ${compliantCount}/${totalItems} controls compliant (${compliancePercent}%). ` +
          (nonCompliant.length > 0
            ? `Non-compliant: ${nonCompliant.map(c => c.control_code || 'Unknown').join(', ')}`
            : 'All controls are compliant.');

        gaps = nonCompliant.map((item) => ({
          issue: item.answer || `Control ${item.control_code} is ${item.status}`,
          risk: item.Risk || item.Severity || item.status,
          severity: item.Severity || 'Medium',
          status: item.status,
          controlCode: item.control_code,
        }));

        suggestions = nonCompliant.map((item) => ({
          risk: `Control ${item.control_code || 'Unknown'} is ${item.status || 'non-compliant'}`,
          severity: item.Severity || 'Medium',
          controlCode: item.control_code,
        }));

        console.log(`[Evidence Review] Array-style: ${totalItems} items, ${nonCompliant.length} non-compliant, ${compliancePercent}%`);
      } else {
        const runpodData = runpodRaw as Record<string, unknown>;

        if (runpodData.policy_compliant_data || runpodData.controls_response) {
          // Governance-style response with controls_response and policy_compliant_data
          const complianceData = parseComplianceData(runpodData as {
            policy_compliant_data?: { total_controls?: number; total_compliant_controls?: number; compliant_percent?: number };
            controls_response?: Array<{ control_code: string; status: string; answer: string; score?: number }>;
          });
          complianceSummary = buildComplianceSummary(complianceData);
          complianceScore = complianceData.compliancePercent;
          gaps = extractGaps(complianceData.controlsResponse);
          const recs = extractRecommendations(complianceData.controlsResponse);
          recommendations = recs.length > 0 ? recs : null;
          suggestions = gaps.length > 0 ? gaps.map((g) => {
            const item = g as { control_code?: string; status?: string };
            return {
              risk: `Control ${item.control_code || 'Unknown'} is ${item.status || 'non-compliant'}`,
              severity: item.status || 'non-compliant',
            };
          }) : null;
          rawResponseArray = complianceData.controlsResponse;
          critique = complianceData.compliancePercent >= 80 ? 'compliant' : 'non-compliant';

          console.log(`[Evidence Review] Governance-style: ${complianceData.compliancePercent}% compliant, ${gaps.length} gaps`);
        } else {
          // Direct-field response format
          critique = (runpodData.critique as string) || null;
          complianceSummary = (runpodData.compliance_summary as string) || null;
          complianceScore = (runpodData.compliance_score as number) || null;
          gaps = runpodData.gaps ? (runpodData.gaps as unknown[]) : null;
          suggestions = runpodData.suggestions ? (runpodData.suggestions as unknown[]) : null;
          recommendations = runpodData.recommendations ? (runpodData.recommendations as unknown[]) : null;

          // If no structured data, try common response fields
          if (!complianceSummary) {
            const fallbackText = (runpodData.answer as string) ||
              (runpodData.response as string) ||
              (runpodData.message as string) ||
              (runpodData.result as string);
            if (fallbackText && typeof fallbackText === 'string') {
              complianceSummary = fallbackText;
            }
          }

          if (Array.isArray(runpodData.evidence_response)) {
            rawResponseArray = runpodData.evidence_response as unknown[];
          } else if (Array.isArray(runpodData.results)) {
            rawResponseArray = runpodData.results as unknown[];
          }

          console.log(`[Evidence Review] Direct-field: critique=${critique}, score=${complianceScore}`);
        }
      }

      // Create review record
      const reviewRecord = await prisma.evidenceAIReview.create({
        data: {
          evidenceId: evidence.id,
          status: 'completed',
          critique,
          complianceSummary,
          complianceScore,
          gaps: gaps && gaps.length > 0 ? JSON.stringify(gaps) : null,
          suggestions: suggestions && suggestions.length > 0 ? JSON.stringify(suggestions) : null,
          similarityScore: !Array.isArray(runpodRaw) ? ((runpodRaw as Record<string, unknown>).similarity_score as number) || null : null,
          recommendations: recommendations && recommendations.length > 0 ? JSON.stringify(recommendations) : null,
          rawResponse: rawResponseArray && rawResponseArray.length > 0
            ? JSON.stringify(rawResponseArray)
            : JSON.stringify(runpodRaw),
          aiOperationId: aiOperation.id,
        },
      });

      // Update evidence status
      await updateEvidenceAIStatus(evidenceId, {
        reviewStatus: 'COMPLETED',
        reviewedAt: new Date(),
      });

      const latencyMs = Date.now() - startTime;
      console.log(`[Evidence Review] ✓ Complete in ${latencyMs}ms - Score: ${complianceScore}%`);

      return NextResponse.json({
        success: true,
        reviewId: reviewRecord.id,
        review: {
          critique,
          complianceSummary,
          complianceScore,
          gaps,
          suggestions,
          similarityScore: !Array.isArray(runpodRaw) ? ((runpodRaw as Record<string, unknown>).similarity_score as number) || null : null,
          recommendations,
        },
      });
    } catch (error: unknown) {
      const err = error as { message?: string; rawResponse?: string; requestId?: string; status?: number };
      console.error('[Evidence Review] Error:', err);

      return errorResponse(err.message || 'Failed to trigger AI review', err.status || 500, {
        details: err.rawResponse?.substring(0, 200) || String(err),
        requestId: err.requestId,
      });
    }
  },
  { resource: 'compliance.evidence', action: 'edit' }
);
