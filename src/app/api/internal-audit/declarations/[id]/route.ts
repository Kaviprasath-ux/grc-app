import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getAuditHeadFilter, getCustomerAccountId } from '@/lib/api-auth';
import { translateRecord } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/internal-audit/declarations/[id]
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);
      const declaration = await prisma.auditDeclaration.findFirst({
        where: { id, ...tenantFilter, ...auditHeadFilter },
      });
      if (!declaration) {
        return NextResponse.json({ error: 'Declaration not found' }, { status: 404 });
      }
      return NextResponse.json(declaration);
    } catch (error) {
      console.error('Error fetching declaration:', error);
      return NextResponse.json({ error: 'Failed to fetch declaration' }, { status: 500 });
    }
  },
  { resource: 'audit.independence', action: 'view' },
);

// PATCH /api/internal-audit/declarations/[id] - update declaration (incl. review/approval)
export const PATCH = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);
      const customerAccountId = getCustomerAccountId(session);

      const existing = await prisma.auditDeclaration.findFirst({
        where: { id, ...tenantFilter, ...auditHeadFilter },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Declaration not found' }, { status: 404 });
      }

      const data: Record<string, unknown> = {};
      // Declarant-editable fields
      for (const f of ['declarantName', 'position', 'department', 'engagement', 'result', 'explanation', 'employeeSignature'] as const) {
        if (body[f] !== undefined) data[f] = body[f] || null;
      }
      if (body.declarationDate !== undefined) data.declarationDate = body.declarationDate ? new Date(body.declarationDate) : null;
      if (body.status !== undefined && ['Draft', 'Submitted', 'Reviewed'].includes(body.status)) {
        data.status = body.status;
      }
      // Reviewer fields — set when an Audit Head / Manager reviews
      for (const f of ['reviewerName', 'reviewerSignature'] as const) {
        if (body[f] !== undefined) data[f] = body[f] || null;
      }
      if (body.reviewedDate !== undefined) data.reviewedDate = body.reviewedDate ? new Date(body.reviewedDate) : null;
      if (body.status === 'Reviewed') {
        data.reviewedById = session.id || null;
        if (!data.reviewedDate) data.reviewedDate = new Date();
      }

      const declaration = await prisma.auditDeclaration.update({
        where: { id: existing.id },
        data,
      });
      void translateRecord(customerAccountId, 'AuditDeclaration', declaration.id, {
        declarantName: declaration.declarantName || '',
        position: declaration.position || '',
        engagement: declaration.engagement || '',
      });
      return NextResponse.json(declaration);
    } catch (error) {
      console.error('Error updating declaration:', error);
      return NextResponse.json({ error: 'Failed to update declaration' }, { status: 500 });
    }
  },
  { resource: 'audit.independence', action: 'edit' },
);

// DELETE /api/internal-audit/declarations/[id]
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);
      const existing = await prisma.auditDeclaration.findFirst({
        where: { id, ...tenantFilter, ...auditHeadFilter },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Declaration not found' }, { status: 404 });
      }
      await prisma.auditDeclaration.delete({ where: { id: existing.id } });
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error deleting declaration:', error);
      return NextResponse.json({ error: 'Failed to delete declaration' }, { status: 500 });
    }
  },
  { resource: 'audit.independence', action: 'delete' },
);
