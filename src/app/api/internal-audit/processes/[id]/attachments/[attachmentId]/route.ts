import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getCustomerAccountId, getAuditHeadId } from '@/lib/api-auth';
import { maybeDecryptBytes } from '@/lib/encryption';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

interface RouteContext {
  params: Promise<{ id: string; attachmentId: string }>;
}

// GET /api/internal-audit/processes/[id]/attachments/[attachmentId] - download
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { id, attachmentId } = await (context as RouteContext).params;
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);

      const iaProcess = await prisma.internalAuditProcess.findFirst({
        where: {
          id,
          ...(customerAccountId ? { customerAccountId } : {}),
          ...(auditHeadId ? { auditHeadId } : {}),
        },
        select: { id: true },
      });
      if (!iaProcess) {
        return NextResponse.json({ error: 'Process not found' }, { status: 404 });
      }

      // Raw SQL bypasses the Prisma extension; decrypt manually.
      const rows = await prisma.$queryRaw<
        Array<{ fileName: string; fileType: string | null; fileData: Buffer | null }>
      >`SELECT "fileName", "fileType", "fileData" FROM "InternalAuditProcessAttachment" WHERE "id" = ${attachmentId} AND "processId" = ${id} LIMIT 1`;

      const row = rows[0];
      if (!row) {
        return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
      }

      const decrypted = row.fileData ? maybeDecryptBytes(row.fileData) : null;
      if (!decrypted || !decrypted.length) {
        return NextResponse.json({ error: 'File data not available' }, { status: 404 });
      }

      const arrayBuffer = decrypted.buffer.slice(
        decrypted.byteOffset,
        decrypted.byteOffset + decrypted.byteLength
      ) as ArrayBuffer;

      return new NextResponse(arrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': row.fileType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${row.fileName.replace(/"/g, '')}"`,
        },
      });
    } catch (error) {
      console.error('Error downloading IA process attachment:', error);
      return NextResponse.json({ error: 'Failed to download attachment' }, { status: 500 });
    }
  },
  { resource: 'audit.process', action: 'view' }
);

// DELETE /api/internal-audit/processes/[id]/attachments/[attachmentId]
export const DELETE = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { id, attachmentId } = await (context as RouteContext).params;
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);

      const iaProcess = await prisma.internalAuditProcess.findFirst({
        where: {
          id,
          ...(customerAccountId ? { customerAccountId } : {}),
          ...(auditHeadId ? { auditHeadId } : {}),
        },
        select: { id: true },
      });
      if (!iaProcess) {
        return NextResponse.json({ error: 'Process not found' }, { status: 404 });
      }

      const attachment = await prisma.internalAuditProcessAttachment.findUnique({
        where: { id: attachmentId },
        select: { id: true, processId: true, filePath: true },
      });

      if (!attachment || attachment.processId !== id) {
        return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
      }

      if (attachment.filePath) {
        const diskPath = path.join(process.cwd(), attachment.filePath.replace(/^\//, ''));
        if (existsSync(diskPath)) {
          try {
            await unlink(diskPath);
          } catch (err) {
            console.warn(`[IA Process Attachment] Could not delete file from disk: ${diskPath}`, err);
          }
        }
      }

      await prisma.internalAuditProcessAttachment.delete({ where: { id: attachmentId } });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error deleting IA process attachment:', error);
      return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 });
    }
  },
  { resource: 'audit.process', action: 'delete' }
);
