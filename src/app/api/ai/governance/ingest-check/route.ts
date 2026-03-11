import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
    missingFieldResponse,
    notFoundResponse,
} from "@/lib/ai-route-helpers";

export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/governance/ingest-check?policyId={id}
 *
 * Check if a policy document has been ingested and is ready for review.
 * Returns the ingest status and latest PolicyAIReview record.
 *
 * Used by useGovernanceAIReview hook to determine if ingest step can be skipped.
 */
async function handler(
    req: NextRequest,
    _context: unknown,
    session: AuthenticatedRequest['user']
) {
    try {
        const { searchParams } = new URL(req.url);
        const policyId = searchParams.get('policyId');

        if (!policyId) {
            return missingFieldResponse('policyId');
        }

        // Fetch policy with AI fields, attachments, and vault document links
        const policy = await prisma.policy.findUnique({
            where: { id: policyId },
            select: {
                id: true,
                aiIngestStatus: true,
                aiIngestJobId: true,
                aiIngestedAt: true,
                aiReviewStatus: true,
                attachments: {
                    select: {
                        id: true,
                        fileName: true,
                        filePath: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
                vaultDocumentLinks: {
                    select: {
                        document: {
                            select: {
                                id: true,
                                fileName: true,
                                filePath: true,
                            },
                        },
                    },
                    orderBy: { linkedAt: 'desc' },
                    take: 1,
                },
            },
        });

        if (!policy) {
            return notFoundResponse('Policy');
        }

        // Get the latest PolicyAIReview record
        const latestReview = await prisma.policyAIReview.findFirst({
            where: { policyId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                status: true,
                documentId: true,
                complianceSummary: true,
                riskScore: true,
                reviewedAt: true,
                createdAt: true,
            },
        });

        // Determine if document is ingested
        // A document is considered ingested if:
        // 1. Policy.aiIngestStatus === 'INGESTED', OR
        // 2. PolicyAIReview.status === 'ingested' OR 'completed'
        const isIngested =
            policy.aiIngestStatus === 'INGESTED' ||
            latestReview?.status === 'ingested' ||
            latestReview?.status === 'completed';

        // Get document ID from latest review or use policy ID
        const documentId = latestReview?.documentId || null;

        // Check if there's an attachment (either direct or vault-linked)
        const hasAttachment = policy.attachments.length > 0 || policy.vaultDocumentLinks.length > 0;

        return NextResponse.json({
            isIngested,
            ingestStatus: policy.aiIngestStatus || 'NOT_STARTED',
            jobId: policy.aiIngestJobId,
            documentId,
            hasAttachment,
            attachment: policy.attachments[0] || (policy.vaultDocumentLinks[0]?.document ? {
                id: policy.vaultDocumentLinks[0].document.id,
                fileName: policy.vaultDocumentLinks[0].document.fileName,
                filePath: policy.vaultDocumentLinks[0].document.filePath,
            } : null),
            latestReview: latestReview ? {
                id: latestReview.id,
                status: latestReview.status,
                documentId: latestReview.documentId,
                complianceSummary: latestReview.complianceSummary,
                riskScore: latestReview.riskScore,
                reviewedAt: latestReview.reviewedAt,
            } : null,
        });
    } catch (error: unknown) {
        const err = error as { message?: string };
        console.error('[Governance Ingest Check] Error:', err);
        return NextResponse.json(
            { error: 'Unable to check ingest status. Please try again.' },
            { status: 500 }
        );
    }
}

export const GET = withAuthOnly(handler);
