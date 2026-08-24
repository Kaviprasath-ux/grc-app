import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getCustomerAccountId, getAuditHeadId } from '@/lib/api-auth';
import { saveUploadedFile } from '@/lib/file-upload';
import { maybeEncryptBytes } from '@/lib/encryption';
import { validateUploadedFiles } from '@/lib/upload-validation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET attachments for an IA process
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);

      const process = await prisma.internalAuditProcess.findFirst({
        where: {
          id,
          ...(customerAccountId ? { customerAccountId } : {}),
          ...(auditHeadId ? { auditHeadId } : {}),
        },
        include: { attachments: true },
      });
      if (!process) {
        return NextResponse.json({ error: 'Process not found' }, { status: 404 });
      }
      return NextResponse.json(
        process.attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          fileType: a.fileType,
          fileSize: a.fileSize,
          uploadedAt: a.uploadedAt.toISOString(),
        }))
      );
    } catch (error) {
      console.error('Error listing IA process attachments:', error);
      return NextResponse.json({ error: 'Failed to list attachments' }, { status: 500 });
    }
  },
  { resource: 'audit.process', action: 'view' }
);

// POST upload one or more attachments
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);

      const process = await prisma.internalAuditProcess.findFirst({
        where: {
          id,
          ...(customerAccountId ? { customerAccountId } : {}),
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });
      if (!process) {
        return NextResponse.json({ error: 'Process not found' }, { status: 404 });
      }

      const formData = await req.formData();
      const files = formData.getAll('files');
      if (!files || files.length === 0) {
        return NextResponse.json({ error: 'No files provided' }, { status: 400 });
      }
      const check = validateUploadedFiles(files as File[]);
      if (!check.ok) {
        return NextResponse.json({ error: check.reason }, { status: 400 });
      }

      const uploaded: Array<{
        id: string;
        fileName: string;
        fileType: string | null;
        fileSize: number | null;
        uploadedAt: string;
      }> = [];

      for (const file of files) {
        if (!(file instanceof File)) continue;
        const subDir = `internal-audit/processes/${id}`;
        const { urlPath, buffer } = await saveUploadedFile(file, subDir);

        const attachment = await prisma.internalAuditProcessAttachment.create({
          data: {
            processId: id,
            fileName: file.name,
            fileType: file.type || null,
            fileSize: file.size,
            filePath: urlPath,
            uploadedBy: session.id || null,
          },
        });

        // Persist file binary in DB (encrypted) for cloud serverless persistence.
        const encrypted = maybeEncryptBytes(Buffer.from(buffer));
        await prisma.$executeRaw`UPDATE "InternalAuditProcessAttachment" SET "fileData" = ${encrypted} WHERE "id" = ${attachment.id}`;

        uploaded.push({
          id: attachment.id,
          fileName: attachment.fileName,
          fileType: attachment.fileType,
          fileSize: attachment.fileSize,
          uploadedAt: attachment.uploadedAt.toISOString(),
        });
      }

      return NextResponse.json({ files: uploaded }, { status: 201 });
    } catch (error) {
      console.error('Error uploading IA process attachment:', error);
      return NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 });
    }
  },
  { resource: 'audit.process', action: 'edit' }
);
