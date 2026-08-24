import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getCustomerAccountId } from '@/lib/api-auth';
import { saveUploadedFile } from '@/lib/file-upload';
import { isSpreadsheetFile, validateAuditProgramWorkbook } from '@/lib/audit-program-template';
import { validateUploadedFiles } from '@/lib/upload-validation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Metadata-only shape (never returns the encrypted fileData blob)
function attachmentMetadata(att: {
  id: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  filePath: string;
  uploadedBy: string | null;
  uploadedByName: string | null;
  uploadedAt: Date;
  createdAt: Date;
}) {
  return {
    id: att.id,
    fileName: att.fileName,
    fileType: att.fileType,
    fileSize: att.fileSize,
    filePath: att.filePath,
    uploadedBy: att.uploadedBy,
    uploadedByName: att.uploadedByName,
    uploadedAt: att.uploadedAt,
    createdAt: att.createdAt,
  };
}

// POST /api/internal-audit/engagements/[id]/apm/attachments - Upload attachments
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      // Verify engagement exists and belongs to tenant
      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true },
      });

      if (!engagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      if (!session.customerAccountId) {
        return NextResponse.json(
          { error: 'User does not have a customer account assigned' },
          { status: 400 }
        );
      }
      const customerAccountId = getCustomerAccountId(session);

      // Ensure an APM row exists for this engagement
      let apm = await prisma.auditEngagementAPM.findUnique({
        where: { engagementId: id },
        select: { id: true },
      });

      if (!apm) {
        apm = await prisma.auditEngagementAPM.create({
          data: {
            customerAccountId,
            engagementId: id,
            createdById: session.id,
            createdByName: session.name || null,
          },
          select: { id: true },
        });
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
      const check = validateUploadedFiles(files as File[]);
      if (!check.ok) {
        return NextResponse.json({ error: check.reason }, { status: 400 });
      }

      // Validation pass: any uploaded spreadsheet must match the Audit Program
      // template (so a filled-in template is checked before it is stored).
      // Non-spreadsheet files (supporting docs) are allowed through.
      for (const file of files) {
        if (file instanceof File && isSpreadsheetFile(file.name)) {
          const buf = Buffer.from(await file.arrayBuffer());
          const result = validateAuditProgramWorkbook(buf);
          if (!result.valid) {
            return NextResponse.json(
              {
                error: result.reason || 'The uploaded file does not match the Audit Program template.',
                fileName: file.name,
                missing: result.missing,
              },
              { status: 400 }
            );
          }
        }
      }

      const uploadedFiles = [];

      for (const file of files) {
        if (file instanceof File) {
          const subDir = `internal-audit/engagements/${id}/apm`;
          const { urlPath, buffer } = await saveUploadedFile(file, subDir);

          // Create attachment record. fileData is auto-encrypted by the
          // Prisma client extension - no manual encryption needed.
          const attachment = await prisma.auditEngagementAPMAttachment.create({
            data: {
              apmId: apm.id,
              fileName: file.name,
              fileType: file.type || null,
              fileSize: file.size,
              filePath: urlPath,
              fileData: buffer,
              uploadedBy: session.id,
              uploadedByName: session.name || null,
            },
          });

          uploadedFiles.push(attachmentMetadata(attachment));
        }
      }

      return NextResponse.json(uploadedFiles, { status: 201 });
    } catch (error) {
      console.error('Error uploading APM attachments:', error);
      return NextResponse.json(
        { error: 'Failed to upload APM attachments' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);

// GET /api/internal-audit/engagements/[id]/apm/attachments - List attachments
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      // Verify engagement exists and belongs to tenant
      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true },
      });

      if (!engagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      const apm = await prisma.auditEngagementAPM.findUnique({
        where: { engagementId: id },
        include: {
          attachments: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!apm) {
        return NextResponse.json([]);
      }

      return NextResponse.json(apm.attachments.map(attachmentMetadata));
    } catch (error) {
      console.error('Error fetching APM attachments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch APM attachments' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);
