import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, validateTenantAccess, forbidden } from '@/lib/api-auth';
import { saveUploadedFile } from '@/lib/file-upload';

interface RouteContext {
  params: Promise<{ findingId: string }>;
}

/**
 * GET /api/internal-audit/capa-tracking/[findingId]/attachments
 * List all attachments for a finding
 */
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { findingId } = await context.params;

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

      // Validate tenant access
      if (!validateTenantAccess(session, finding.customerAccountId)) {
        return forbidden('Access denied to this finding');
      }

      return NextResponse.json(
        finding.attachments.map((att) => ({
          id: att.id,
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
          filePath: att.filePath,
          uploadedBy: att.uploadedBy,
          uploadedAt: att.uploadedAt.toISOString(),
        }))
      );
    } catch (error) {
      console.error('[CAPA Attachments] Error fetching attachments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch attachments' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

/**
 * POST /api/internal-audit/capa-tracking/[findingId]/attachments
 * Upload attachments to a finding (for auditee CAPA submissions)
 */
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { findingId } = await context.params;

      // Verify finding exists
      const finding = await prisma.internalAuditFinding.findUnique({
        where: { id: findingId },
      });

      if (!finding) {
        return NextResponse.json(
          { error: 'Finding not found' },
          { status: 404 }
        );
      }

      // Validate tenant access
      if (!validateTenantAccess(session, finding.customerAccountId)) {
        return forbidden('Access denied to this finding');
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

      const uploadedFiles = [];

      for (const file of files) {
        if (file instanceof File) {
          const subDir = `capa-tracking/${findingId}`;
          const { urlPath } = await saveUploadedFile(file, subDir);

          // Create attachment record in database
          const attachment = await prisma.findingAttachment.create({
            data: {
              findingId: findingId,
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              filePath: urlPath,
              uploadedBy: session.id,
            },
          });

          uploadedFiles.push({
            id: attachment.id,
            fileName: attachment.fileName,
            fileType: attachment.fileType,
            fileSize: attachment.fileSize,
            filePath: attachment.filePath,
            uploadedBy: attachment.uploadedBy,
            uploadedAt: attachment.uploadedAt.toISOString(),
          });
        }
      }

      console.log(`[CAPA Attachments] Uploaded ${uploadedFiles.length} files for finding ${findingId}`);

      // Return array directly (frontend expects array at line 326)
      return NextResponse.json(uploadedFiles, { status: 201 });
    } catch (error) {
      console.error('[CAPA Attachments] Error uploading attachments:', error);
      return NextResponse.json(
        { error: 'Failed to upload attachments' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);
