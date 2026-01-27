import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ findingId: string }>;
}

// Valid file types for CAPA evidence documents
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
  status: 'Satisfactory' | 'Unsatisfactory';
  description: string;
}

/**
 * Analyze uploaded documents and auditee comment to determine if the CAPA evidence is satisfactory.
 * This is a mock implementation - in production, this could call OpenAI/Claude API to analyze document content.
 */
function analyzeDocuments(
  attachments: Array<{ fileName: string; fileType: string | null; fileSize: number | null }>,
  auditeeComment: string | null
): AIReviewResult {
  const issues: string[] = [];
  const positives: string[] = [];

  // Check 1: Document presence
  if (attachments.length === 0) {
    return {
      status: 'Unsatisfactory',
      description: 'No evidence documents were uploaded. Please upload supporting documents to demonstrate corrective actions taken.',
    };
  }

  positives.push(`${attachments.length} document(s) uploaded`);

  // Check 2: Valid file types
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

  // Check 3: Empty files
  const emptyFiles = attachments.filter((att) => att.fileSize === 0 || att.fileSize === null);
  if (emptyFiles.length > 0) {
    issues.push(`${emptyFiles.length} file(s) appear to be empty`);
  }

  // Check 4: File size check (reasonable size check)
  const tooSmallFiles = attachments.filter((att) => att.fileSize && att.fileSize < 100);
  if (tooSmallFiles.length > 0) {
    issues.push(`${tooSmallFiles.length} file(s) are suspiciously small`);
  }

  // Check 5: Auditee comment
  if (!auditeeComment || auditeeComment.trim().length < 10) {
    issues.push('Auditee comment is missing or too brief');
  } else {
    positives.push('Auditee comment provided');
    // Check for substantive comment (more than just a few words)
    if (auditeeComment.trim().split(/\s+/).length >= 5) {
      positives.push('Comment appears substantive');
    }
  }

  // Check 6: Document types (looking for evidence variety)
  const hasMultipleTypes = new Set(attachments.map((a) => a.fileType || a.fileName.split('.').pop())).size > 1;
  if (hasMultipleTypes && attachments.length > 1) {
    positives.push('Multiple document types provided');
  }

  // Determine overall status
  if (issues.length === 0) {
    return {
      status: 'Satisfactory',
      description: `Evidence review completed successfully. ${positives.join('. ')}. Documents appear complete and relevant to the corrective action.`,
    };
  } else if (issues.length <= 1 && attachments.length >= 1) {
    // Minor issues - still satisfactory with notes
    return {
      status: 'Satisfactory',
      description: `Evidence review completed with minor notes. ${positives.join('. ')}. Note: ${issues.join('; ')}. Overall documentation is acceptable.`,
    };
  } else {
    return {
      status: 'Unsatisfactory',
      description: `Evidence review identified concerns: ${issues.join('; ')}. ${positives.length > 0 ? `Positive aspects: ${positives.join(', ')}.` : ''} Please address the noted issues and resubmit.`,
    };
  }
}

// POST /api/internal-audit/capa-tracking/[findingId]/ai-review - Perform AI review of uploaded documents
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { findingId } = await context.params;

      // Find the finding with its attachments
      const finding = await prisma.internalAuditFinding.findUnique({
        where: { id: findingId },
        include: {
          attachments: {
            orderBy: { uploadedAt: 'desc' },
          },
        },
      });

      if (!finding) {
        return NextResponse.json(
          { error: 'Finding not found' },
          { status: 404 }
        );
      }

      // Check if AI review already exists and is approved
      if (finding.aiReviewApproved) {
        return NextResponse.json(
          { error: 'AI review has already been approved by Audit Head' },
          { status: 400 }
        );
      }

      // Perform AI analysis
      const aiResult = analyzeDocuments(
        finding.attachments.map((att) => ({
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
        })),
        finding.description // This stores the auditee comment
      );

      // Update finding with AI review results
      const updatedFinding = await prisma.internalAuditFinding.update({
        where: { id: findingId },
        data: {
          aiReviewStatus: aiResult.status,
          aiReviewDescription: aiResult.description,
          aiReviewedAt: new Date(),
          aiReviewApproved: false, // Requires Audit Head approval
          status: 'Under Review', // Change status to Under Review
        },
        include: {
          attachments: true,
        },
      });

      return NextResponse.json({
        success: true,
        aiReviewStatus: updatedFinding.aiReviewStatus,
        aiReviewDescription: updatedFinding.aiReviewDescription,
        aiReviewedAt: updatedFinding.aiReviewedAt,
        status: updatedFinding.status,
      });
    } catch (error) {
      console.error('Error performing AI review:', error);
      return NextResponse.json(
        { error: 'Failed to perform AI review' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.capa', action: 'edit' }
);
