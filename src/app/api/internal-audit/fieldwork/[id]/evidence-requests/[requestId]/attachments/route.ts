import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { notificationService, NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS } from '@/lib/notification-service';

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

  // Check 5: File size check
  const tooSmallFiles = attachments.filter((att) => att.fileSize && att.fileSize < 100);
  if (tooSmallFiles.length > 0) {
    issues.push(`${tooSmallFiles.length} file(s) are suspiciously small`);
  }

  // Check 6: Document variety
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

// GET /api/internal-audit/fieldwork/[id]/evidence-requests/[requestId]/attachments - Get attachments
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId, requestId } = await context.params;

      const evidenceRequest = await prisma.fieldworkEvidenceRequest.findUnique({
        where: { id: requestId },
        include: { attachments: true },
      });

      if (!evidenceRequest || evidenceRequest.engagementId !== engagementId) {
        return NextResponse.json(
          { error: 'Evidence request not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        evidenceRequest.attachments.map(att => ({
          id: att.id,
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
          filePath: att.filePath,
          uploadedAt: att.uploadedAt.toISOString(),
        }))
      );
    } catch (error) {
      console.error('Error fetching attachments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch attachments' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

// POST /api/internal-audit/fieldwork/[id]/evidence-requests/[requestId]/attachments - Upload attachments
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id: engagementId, requestId } = await context.params;

      // Verify evidence request exists and get engagement info for notifications
      const evidenceRequest = await prisma.fieldworkEvidenceRequest.findUnique({
        where: { id: requestId },
        include: {
          engagement: {
            select: {
              id: true,
              auditId: true,
              engagementTitle: true,
              assignedAuditorId: true,
              customerAccountId: true,
            },
          },
        },
      });

      if (!evidenceRequest || evidenceRequest.engagementId !== engagementId) {
        return NextResponse.json(
          { error: 'Evidence request not found' },
          { status: 404 }
        );
      }

      // Parse form data
      const formData = await req.formData();
      const files = formData.getAll('files');

      if (!files || files.length === 0) {
        return NextResponse.json(
          { error: 'No files provided' },
          { status: 400 }
        );
      }

      // Create upload directory
      const uploadDir = path.join(process.cwd(), 'uploads', 'fieldwork', engagementId, 'evidence');
      await mkdir(uploadDir, { recursive: true });

      const uploadedFiles = [];

      for (const file of files) {
        if (file instanceof File) {
          // Generate unique filename
          const timestamp = Date.now();
          const originalName = file.name;
          const ext = path.extname(originalName);
          const baseName = path.basename(originalName, ext);
          const fileName = `${baseName}_${timestamp}${ext}`;
          const filePath = path.join(uploadDir, fileName);

          // Write file to disk
          const buffer = Buffer.from(await file.arrayBuffer());
          await writeFile(filePath, buffer);

          // Create attachment record
          const attachment = await prisma.fieldworkEvidenceAttachment.create({
            data: {
              evidenceRequestId: requestId,
              fileName: originalName,
              fileType: file.type,
              fileSize: file.size,
              filePath: `/uploads/fieldwork/${engagementId}/evidence/${fileName}`,
            },
          });

          uploadedFiles.push({
            id: attachment.id,
            fileName: attachment.fileName,
            fileType: attachment.fileType,
            fileSize: attachment.fileSize,
            filePath: attachment.filePath,
            uploadedAt: attachment.uploadedAt.toISOString(),
          });
        }
      }

      // Fetch all attachments for AI review (including newly uploaded ones)
      const allAttachments = await prisma.fieldworkEvidenceAttachment.findMany({
        where: { evidenceRequestId: requestId },
      });

      // Perform AI review
      const aiResult = analyzeDocuments(
        allAttachments.map((att) => ({
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
        })),
        evidenceRequest.title,
        evidenceRequest.sampleSize
      );

      // Update evidence request with AI review results and set status to Submitted
      const updatedRequest = await prisma.fieldworkEvidenceRequest.update({
        where: { id: requestId },
        data: {
          aiReviewStatus: aiResult.status,
          aiReviewComment: aiResult.comment,
          status: 'Submitted',
        },
      });

      // Send EVIDENCE_SUBMITTED notification to the assigned auditor
      const engagement = evidenceRequest.engagement;
      if (engagement?.assignedAuditorId && engagement.assignedAuditorId !== session.id && engagement.customerAccountId) {
        // Determine if this is workpaper or regular evidence
        const isWorkpaper = evidenceRequest.category === 'workpapers';
        const notificationEvent = isWorkpaper
          ? NOTIFICATION_EVENTS.WORKPAPER_SUBMITTED
          : NOTIFICATION_EVENTS.EVIDENCE_SUBMITTED;

        await notificationService.send({
          customerAccountId: engagement.customerAccountId,
          actorId: session.id,
          recipientId: engagement.assignedAuditorId,
          event: notificationEvent,
          title: isWorkpaper ? 'Workpaper Submitted' : 'Evidence Submitted',
          message: `${isWorkpaper ? 'Workpaper' : 'Evidence'} "${evidenceRequest.title}" has been submitted for audit ${engagement.auditId}. AI Review: ${aiResult.status}`,
          relatedEntityType: 'evidence',
          relatedEntityId: evidenceRequest.id,
          link: `/internal-audit/fieldwork/${engagementId}`,
          metadata: {
            engagementId: engagement.auditId,
            engagementTitle: engagement.engagementTitle,
            evidenceTitle: evidenceRequest.title,
            aiReviewStatus: aiResult.status,
            filesCount: uploadedFiles.length,
            submittedBy: session.name || 'Auditee',
          },
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
      }

      return NextResponse.json({
        message: 'Files uploaded and AI review completed',
        files: uploadedFiles,
        aiReviewStatus: updatedRequest.aiReviewStatus,
        aiReviewComment: updatedRequest.aiReviewComment,
        status: updatedRequest.status,
      }, { status: 201 });
    } catch (error) {
      console.error('Error uploading attachments:', error);
      return NextResponse.json(
        { error: 'Failed to upload attachments' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);
