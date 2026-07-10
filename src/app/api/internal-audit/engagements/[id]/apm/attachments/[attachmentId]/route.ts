import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter } from '@/lib/api-auth';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getUploadBaseDir } from '@/lib/file-upload';

interface RouteContext {
  params: Promise<{ id: string; attachmentId: string }>;
}

function getContentType(fileType: string): string {
  const types: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    txt: 'text/plain',
    zip: 'application/zip',
  };
  return types[fileType] || 'application/octet-stream';
}

// GET /api/internal-audit/engagements/[id]/apm/attachments/[attachmentId] - Download attachment binary
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id, attachmentId } = await context.params;
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

      // Fetch via Prisma client so fileData auto-decrypts
      const attachment = await prisma.auditEngagementAPMAttachment.findUnique({
        where: { id: attachmentId },
        include: {
          apm: {
            select: { engagementId: true },
          },
        },
      });

      // Confirm it belongs to this engagement's APM
      if (!attachment || attachment.apm.engagementId !== id) {
        return NextResponse.json(
          { error: 'Attachment not found' },
          { status: 404 }
        );
      }

      let fileBuffer: Buffer | null = attachment.fileData
        ? Buffer.from(attachment.fileData)
        : null;

      // Fall back to disk (local dev) if no inline blob
      if (!fileBuffer && attachment.filePath) {
        const baseDir = getUploadBaseDir();
        const relativePath = attachment.filePath.replace(/^\/uploads\//, '');
        const candidates = [
          path.join(baseDir, relativePath),
          path.join('/tmp', 'uploads', relativePath),
        ];
        for (const filePath of candidates) {
          if (existsSync(filePath)) {
            try {
              fileBuffer = await readFile(filePath);
              break;
            } catch {
              // try next candidate
            }
          }
        }
      }

      if (!fileBuffer) {
        return NextResponse.json(
          { error: 'File not found on server' },
          { status: 404 }
        );
      }

      const ext = path.extname(attachment.fileName).replace('.', '').toLowerCase();
      const contentType = getContentType(ext);

      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${attachment.fileName}"`,
          'Content-Length': fileBuffer.length.toString(),
        },
      });
    } catch (error) {
      console.error('Error downloading APM attachment:', error);
      return NextResponse.json(
        { error: 'Failed to download APM attachment' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

// DELETE /api/internal-audit/engagements/[id]/apm/attachments/[attachmentId] - Delete attachment
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id, attachmentId } = await context.params;
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

      // Verify attachment belongs to this engagement's APM
      const attachment = await prisma.auditEngagementAPMAttachment.findUnique({
        where: { id: attachmentId },
        include: {
          apm: {
            select: { engagementId: true },
          },
        },
      });

      if (!attachment || attachment.apm.engagementId !== id) {
        return NextResponse.json(
          { error: 'Attachment not found' },
          { status: 404 }
        );
      }

      await prisma.auditEngagementAPMAttachment.delete({
        where: { id: attachmentId },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error deleting APM attachment:', error);
      return NextResponse.json(
        { error: 'Failed to delete APM attachment' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);
