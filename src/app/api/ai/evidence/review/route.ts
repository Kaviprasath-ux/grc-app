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
      const requestBody = buildEvidencePayload(evidence, session.id);

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

      const runpodData = response.data as Record<string, unknown>;

      // Update AI operation with response
      await updateAIOperation(aiOperation.id, {
        data: runpodData,
        status: response.status,
        latencyMs: Date.now() - startTime,
      });

      // Create review record
      const reviewRecord = await prisma.evidenceAIReview.create({
        data: {
          evidenceId: evidence.id,
          status: 'completed',
          critique: (runpodData.critique as string) || null,
          complianceSummary: (runpodData.compliance_summary as string) || null,
          complianceScore: (runpodData.compliance_score as number) || null,
          gaps: runpodData.gaps ? JSON.stringify(runpodData.gaps) : null,
          suggestions: runpodData.suggestions ? JSON.stringify(runpodData.suggestions) : null,
          similarityScore: (runpodData.similarity_score as number) || null,
          recommendations: runpodData.recommendations ? JSON.stringify(runpodData.recommendations) : null,
          rawResponse: JSON.stringify(runpodData),
          aiOperationId: aiOperation.id,
        },
      });

      // Update evidence status
      await updateEvidenceAIStatus(evidenceId, {
        reviewStatus: 'COMPLETED',
        reviewedAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        reviewId: reviewRecord.id,
        review: {
          critique: reviewRecord.critique,
          complianceSummary: reviewRecord.complianceSummary,
          complianceScore: reviewRecord.complianceScore,
          gaps: reviewRecord.gaps ? JSON.parse(reviewRecord.gaps) : null,
          suggestions: reviewRecord.suggestions ? JSON.parse(reviewRecord.suggestions) : null,
          similarityScore: reviewRecord.similarityScore,
          recommendations: reviewRecord.recommendations ? JSON.parse(reviewRecord.recommendations) : null,
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
