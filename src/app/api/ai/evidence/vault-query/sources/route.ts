import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, validateTenantAccess, forbidden } from '@/lib/api-auth';
import {
  missingFieldResponse,
  notFoundResponse,
  errorResponse,
} from '@/lib/ai-route-helpers';

/**
 * GET /api/ai/evidence/vault-query/sources
 *
 * Fetch sources with linked evidence details and document tracking info
 * Query params:
 *   - reviewId: ID of the EvidenceAIReview record
 *   - evidenceId: (optional) Filter by evidence ID
 */
export const GET = withAuth(
  async (req: NextRequest, _context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const reviewId = searchParams.get('reviewId');
      const evidenceId = searchParams.get('evidenceId');

      // Build query filter
      let whereClause: { id?: string; evidenceId?: string } = {};

      if (reviewId) {
        whereClause.id = reviewId;
      } else if (evidenceId) {
        whereClause.evidenceId = evidenceId;
      } else {
        return missingFieldResponse('reviewId or evidenceId');
      }

      // Fetch review(s) with relations
      const reviews = await prisma.evidenceAIReview.findMany({
        where: whereClause,
        include: {
          evidence: {
            select: {
              id: true,
              evidenceCode: true,
              description: true,
              customerAccountId: true,
            },
          },
          artifact: {
            select: {
              id: true,
              artifactCode: true,
              fileName: true,
              fileType: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: reviewId ? 1 : 50, // Limit results when querying by evidence
      });

      if (reviews.length === 0) {
        return notFoundResponse('EvidenceAIReview');
      }

      // Validate tenant access using first review's evidence
      if (!validateTenantAccess(session, reviews[0].evidence.customerAccountId)) {
        return forbidden('Access denied to this evidence');
      }

      // Map reviews to response format with document tracking
      const response = reviews.map((review) => {
        let sources: unknown[] = [];
        try {
          sources = review.sources ? JSON.parse(review.sources) : [];
        } catch {
          // If sources parsing fails, try legacy location in suggestions
          try {
            sources = review.suggestions ? JSON.parse(review.suggestions) : [];
          } catch {
            sources = [];
          }
        }

        return {
          reviewId: review.id,
          status: review.status,
          createdAt: review.createdAt,
          updatedAt: review.updatedAt,

          // Evidence info
          evidenceId: review.evidenceId,
          evidenceCode: review.evidence.evidenceCode,
          evidenceDescription: review.evidence.description,

          // Artifact info (if linked)
          artifactId: review.artifactId,
          artifactCode: review.artifact?.artifactCode || null,
          artifactFileName: review.artifact?.fileName || null,

          // Document tracking
          documentTracking: {
            evidenceDocumentId: review.evidenceDocumentId,
            artifactDocumentId: review.artifactDocumentId,
            ingestJobId: review.ingestJobId,
            runpodDocumentRef: review.runpodDocumentRef,
            // Legacy field for backward compatibility
            documentId: review.documentId,
          },

          // AI response data
          complianceSummary: review.complianceSummary,
          complianceScore: review.complianceScore,
          sources,
        };
      });

      // Return single object if querying by reviewId, array otherwise
      if (reviewId && response.length === 1) {
        return NextResponse.json(response[0]);
      }

      return NextResponse.json({
        count: response.length,
        reviews: response,
      });
    } catch (error: unknown) {
      const err = error as { message?: string; status?: number };
      console.error('[Vault Query Sources] Error:', err);

      return errorResponse(
        err.message || 'Failed to fetch vault query sources',
        err.status || 500
      );
    }
  },
  { resource: 'compliance.evidence', action: 'view' }
);
