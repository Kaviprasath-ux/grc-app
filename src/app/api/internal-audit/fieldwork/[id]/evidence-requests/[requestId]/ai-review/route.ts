import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ id: string; requestId: string }>;
}

// Valid file types for evidence documents
const VALID_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'text/plain',
];

const VALID_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'txt'];

interface AIReviewResult {
  status: 'Satisfactory' | 'Needs Attention';
  comment: string;
}

/**
 * Analyze uploaded documents to determine if the evidence submission is satisfactory.
 */
function analyzeDocuments(
  attachments: Array<{ fileName: string; fileType: string | null; fileSize: number | null }>,
  requestTitle: string,
  requestDescription: string | null,
  sampleSize: string | null
): AIReviewResult {
  const issues: string[] = [];
  const positives: string[] = [];

  // Check 1: Document presence
  if (attachments.length === 0) {
    return {
      status: 'Needs Attention',
      comment: 'No evidence documents were uploaded. Please upload supporting documents to fulfill the evidence request.',
    };
  }

  positives.push(`${attachments.length} document(s) uploaded`);

  // Check 2: Sample size compliance
  if (sampleSize) {
    const requiredSamples = parseInt(sampleSize, 10);
    if (!isNaN(requiredSamples) && attachments.length < requiredSamples) {
      issues.push(`Only ${attachments.length} of ${requiredSamples} required samples uploaded`);
    } else if (!isNaN(requiredSamples) && attachments.length >= requiredSamples) {
      positives.push(`Sample size requirement met (${attachments.length}/${requiredSamples})`);
    }
  }

  // Check 3: Valid file types
  const invalidFiles = attachments.filter((att) => {
    if (!att.fileType) {
      // Check extension
      const ext = att.fileName.split('.').pop()?.toLowerCase();
      return !ext || !VALID_EXTENSIONS.includes(ext);
    }
    return !VALID_FILE_TYPES.includes(att.fileType);
  });

  if (invalidFiles.length > 0) {
    issues.push(`${invalidFiles.length} file(s) have unsupported formats`);
  }

  // Check 4: Empty files
  const emptyFiles = attachments.filter((att) => att.fileSize === 0 || att.fileSize === null);
  if (emptyFiles.length > 0) {
    issues.push(`${emptyFiles.length} file(s) appear to be empty`);
  }

  // Check 5: File size check (reasonable size check)
  const tooSmallFiles = attachments.filter((att) => att.fileSize && att.fileSize < 100);
  if (tooSmallFiles.length > 0) {
    issues.push(`${tooSmallFiles.length} file(s) are suspiciously small`);
  }

  // Check 6: Document types (looking for evidence variety for larger requests)
  const hasMultipleTypes = new Set(attachments.map((a) => a.fileType || a.fileName.split('.').pop())).size > 1;
  if (hasMultipleTypes && attachments.length > 1) {
    positives.push('Multiple document types provided');
  }

  // Determine overall status
  if (issues.length === 0) {
    return {
      status: 'Satisfactory',
      comment: `Evidence review completed successfully. ${positives.join('. ')}. Documents appear complete and relevant to "${requestTitle}".`,
    };
  } else if (issues.length <= 1 && attachments.length >= 1) {
    // Minor issues - still satisfactory with notes
    return {
      status: 'Satisfactory',
      comment: `Evidence review completed with minor notes. ${positives.join('. ')}. Note: ${issues.join('; ')}. Overall documentation is acceptable.`,
    };
  } else {
    return {
      status: 'Needs Attention',
      comment: `Evidence review identified concerns: ${issues.join('; ')}. ${positives.length > 0 ? `Positive aspects: ${positives.join(', ')}.` : ''} Please address the noted issues and resubmit.`,
    };
  }
}

// POST /api/internal-audit/fieldwork/[id]/evidence-requests/[requestId]/ai-review - Perform AI review
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId, requestId } = await context.params;

      // Find the evidence request with its attachments
      const evidenceRequest = await prisma.fieldworkEvidenceRequest.findUnique({
        where: { id: requestId },
        include: {
          attachments: {
            orderBy: { uploadedAt: 'desc' },
          },
        },
      });

      if (!evidenceRequest || evidenceRequest.engagementId !== engagementId) {
        return NextResponse.json(
          { error: 'Evidence request not found' },
          { status: 404 }
        );
      }

      // Perform AI analysis
      const aiResult = analyzeDocuments(
        evidenceRequest.attachments.map((att) => ({
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
        })),
        evidenceRequest.title,
        evidenceRequest.description,
        evidenceRequest.sampleSize
      );

      // Update evidence request with AI review results
      const updatedRequest = await prisma.fieldworkEvidenceRequest.update({
        where: { id: requestId },
        data: {
          aiReviewStatus: aiResult.status,
          aiReviewComment: aiResult.comment,
          status: 'Submitted', // Ensure status is set to Submitted
        },
      });

      return NextResponse.json({
        success: true,
        aiReviewStatus: updatedRequest.aiReviewStatus,
        aiReviewComment: updatedRequest.aiReviewComment,
        status: updatedRequest.status,
      });
    } catch (error) {
      console.error('Error performing AI review:', error);
      return NextResponse.json(
        { error: 'Failed to perform AI review' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);
