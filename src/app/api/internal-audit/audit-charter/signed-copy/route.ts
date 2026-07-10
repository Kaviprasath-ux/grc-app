import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';

const ALLOWED_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function extMime(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return ALLOWED_MIME[ext] ?? null;
}

// POST /api/internal-audit/audit-charter/signed-copy — store uploaded signed copy
export const POST = withAuth(
  async (req: NextRequest, _ctx, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);

      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      const mimeType = extMime(file.name);
      if (!mimeType) {
        return NextResponse.json(
          { error: 'Unsupported file type. Allowed: PDF, DOCX, JPG, PNG' },
          { status: 400 },
        );
      }

      const data = Buffer.from(await file.arrayBuffer());

      await prisma.auditCharter.upsert({
        where: { customerAccountId },
        update: {
          signedCopyFileName: file.name,
          signedCopyData: data,
          signedCopyMimeType: mimeType,
          signedCopyUploadedAt: new Date(),
        },
        create: {
          customerAccountId,
          content: [],
          fieldValues: {},
          signedCopyFileName: file.name,
          signedCopyData: data,
          signedCopyMimeType: mimeType,
          signedCopyUploadedAt: new Date(),
        },
      });

      // Return metadata only (never return file bytes in charter JSON)
      const charter = await prisma.auditCharter.findUnique({
        where: { customerAccountId },
        select: {
          id: true,
          originalFileName: true,
          content: true,
          fieldValues: true,
          uploadedAt: true,
          updatedAt: true,
          signedCopyFileName: true,
          signedCopyMimeType: true,
          signedCopyUploadedAt: true,
        },
      });

      return NextResponse.json(charter, { status: 201 });
    } catch (err) {
      console.error('POST /api/internal-audit/audit-charter/signed-copy:', err);
      return NextResponse.json({ error: 'Failed to upload signed copy' }, { status: 500 });
    }
  },
  { resource: 'audit.charter', action: 'edit' },
);

// GET /api/internal-audit/audit-charter/signed-copy — stream the signed copy file
// ?download=1 forces Content-Disposition: attachment (browser download)
// Without it: inline display (suitable for iframe/img preview)
export const GET = withAuth(
  async (req: NextRequest, _ctx, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);

      const charter = await prisma.auditCharter.findUnique({
        where: { customerAccountId },
        select: {
          signedCopyData: true,
          signedCopyFileName: true,
          signedCopyMimeType: true,
        },
      });

      if (!charter?.signedCopyData) {
        return NextResponse.json({ error: 'No signed copy found' }, { status: 404 });
      }

      const forceDownload = new URL(req.url).searchParams.get('download') === '1';
      const disposition = forceDownload
        ? `attachment; filename="${charter.signedCopyFileName}"`
        : `inline; filename="${charter.signedCopyFileName}"`;

      return new NextResponse(new Uint8Array(charter.signedCopyData), {
        headers: {
          'Content-Type': charter.signedCopyMimeType ?? 'application/octet-stream',
          'Content-Disposition': disposition,
          'Cache-Control': 'private, no-cache',
        },
      });
    } catch (err) {
      console.error('GET /api/internal-audit/audit-charter/signed-copy:', err);
      return NextResponse.json({ error: 'Failed to retrieve signed copy' }, { status: 500 });
    }
  },
  { resource: 'audit.charter', action: 'view' },
);
