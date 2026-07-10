import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import { DEFAULT_CHARTER_CONTENT, hasEditableFields } from '@/lib/charter-default';

// Fields returned to the client — never includes signedCopyData (binary blob)
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

// GET /api/internal-audit/audit-charter — fetch (and auto-create) the tenant's charter
export const GET = withAuth(
  async (_req: NextRequest, _ctx, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      let charter = await prisma.auditCharter.findUnique({
        where: { customerAccountId },
      });

      // Auto-create or reset to default if no editable fields exist
      const needsDefault =
        !charter ||
        !hasEditableFields((charter.content as unknown[]) ?? []);

      if (needsDefault) {
        await prisma.auditCharter.upsert({
          where: { customerAccountId },
          update: {
            content: DEFAULT_CHARTER_CONTENT as unknown as object[],
          },
          create: {
            customerAccountId,
            content: DEFAULT_CHARTER_CONTENT as unknown as object[],
            fieldValues: {},
          },
        });
      }

      const result = await prisma.auditCharter.findUnique({
        where: { customerAccountId },
        select: CHARTER_SELECT,
      });

      return NextResponse.json(result);
    } catch (err) {
      console.error('GET /api/internal-audit/audit-charter:', err);
      return NextResponse.json({ error: 'Failed to load charter' }, { status: 500 });
    }
  },
  { resource: 'audit.charter', action: 'view' }
);

// PATCH /api/internal-audit/audit-charter — save edited field values
export const PATCH = withAuth(
  async (req: NextRequest, _ctx, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { fieldValues } = body as { fieldValues: Record<string, string> };
      if (!fieldValues || typeof fieldValues !== 'object') {
        return NextResponse.json({ error: 'fieldValues object required' }, { status: 400 });
      }

      const charter = await prisma.auditCharter.findUnique({
        where: { customerAccountId },
        select: { id: true },
      });
      if (!charter) {
        return NextResponse.json({ error: 'Charter not found' }, { status: 404 });
      }

      const updated = await prisma.auditCharter.update({
        where: { customerAccountId },
        data: { fieldValues },
        select: CHARTER_SELECT,
      });
      return NextResponse.json(updated);
    } catch (err) {
      console.error('PATCH /api/internal-audit/audit-charter:', err);
      return NextResponse.json({ error: 'Failed to save charter' }, { status: 500 });
    }
  },
  { resource: 'audit.charter', action: 'edit' }
);
