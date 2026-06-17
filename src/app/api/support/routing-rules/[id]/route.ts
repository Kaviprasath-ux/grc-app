import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  withAuth,
  validateTenantAccess,
  forbidden,
  type AuthenticatedRequest,
} from '@/lib/api-auth';
import { isTicketPriority, isTicketTier } from '@/lib/support/constants';

type Session = AuthenticatedRequest['user'];

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ==================== PATCH ====================
export const PATCH = withAuth(
  async (req: NextRequest, ctx: RouteContext, session: Session) => {
    const { id } = await ctx.params;
    const existing = await prisma.supportRoutingRule.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!validateTenantAccess(session, existing.customerAccountId)) return forbidden('Access denied');

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (typeof body.category === 'string' && body.category.trim()) data.category = body.category.trim();
    if (isTicketTier(body.defaultTier)) data.defaultTier = body.defaultTier;
    if (isTicketPriority(body.defaultPriority)) data.defaultPriority = body.defaultPriority;
    if ('assignToDepartmentId' in body) {
      data.assignToDepartmentId = body.assignToDepartmentId ? body.assignToDepartmentId.toString() : null;
    }
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
    if ('keywords' in body) {
      if (Array.isArray(body.keywords)) {
        data.keywords = JSON.stringify(body.keywords.filter((k: unknown) => typeof k === 'string'));
      } else if (typeof body.keywords === 'string') {
        data.keywords = body.keywords.trim()
          ? JSON.stringify(body.keywords.split(',').map((k: string) => k.trim()).filter(Boolean))
          : null;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const rule = await prisma.supportRoutingRule.update({ where: { id }, data });
    return NextResponse.json(rule);
  },
  { resource: 'support.settings', action: 'edit' },
);

// ==================== DELETE ====================
export const DELETE = withAuth(
  async (_req: NextRequest, ctx: RouteContext, session: Session) => {
    const { id } = await ctx.params;
    const existing = await prisma.supportRoutingRule.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!validateTenantAccess(session, existing.customerAccountId)) return forbidden('Access denied');

    await prisma.supportRoutingRule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  },
  { resource: 'support.settings', action: 'delete' },
);
