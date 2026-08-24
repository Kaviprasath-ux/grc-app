import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import { parseDocxToBlocks } from '@/lib/charter-parser';
import { validateUploadedFile } from '@/lib/upload-validation';

const CHARTER_SELECT = {
  id: true,
  originalFileName: true,
  content: true,
  fieldValues: true,
  uploadedAt: true,
  updatedAt: true,
  signedCopyFileName: true,
  signedCopyMimeType: true,
  signedCopyUploadedAt: true,
} as const;

// POST /api/internal-audit/audit-charter/upload — parse a DOCX and persist the charter
export const POST = withAuth(
  async (req: NextRequest, _ctx, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);

      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }
      const check = validateUploadedFile(file);
      if (!check.ok) {
        return NextResponse.json({ error: check.reason }, { status: 400 });
      }
      if (!file.name.toLowerCase().endsWith('.docx')) {
        return NextResponse.json({ error: 'Only .docx files are supported' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const content = await parseDocxToBlocks(buffer);

      await prisma.auditCharter.upsert({
        where: { customerAccountId },
        update: {
          originalFileName: file.name,
          content: content as unknown as object[],
          fieldValues: {},
          uploadedAt: new Date(),
        },
        create: {
          customerAccountId,
          originalFileName: file.name,
          content: content as unknown as object[],
          fieldValues: {},
        },
      });

      const charter = await prisma.auditCharter.findUnique({
        where: { customerAccountId },
        select: CHARTER_SELECT,
      });

      return NextResponse.json(charter, { status: 201 });
    } catch (err) {
      console.error('POST /api/internal-audit/audit-charter/upload:', err);
      return NextResponse.json({ error: 'Failed to parse charter document' }, { status: 500 });
    }
  },
  { resource: 'audit.charter', action: 'edit' }
);
