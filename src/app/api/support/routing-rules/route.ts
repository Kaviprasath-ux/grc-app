import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  withAuth,
  getTenantFilter,
  getCustomerAccountId,
  type AuthenticatedRequest,
} from '@/lib/api-auth';
import { isTicketPriority, isTicketTier } from '@/lib/support/constants';

type Session = AuthenticatedRequest['user'];

// ==================== GET (list rules) ====================
export const GET = withAuth(
  async (_req: NextRequest, _ctx, session: Session) => {
    const rules = await prisma.supportRoutingRule.findMany({
      where: { ...getTenantFilter(session) },
      orderBy: { category: 'asc' },
    });
    return NextResponse.json({ rules });
  },
  { resource: 'support.settings', action: 'view' },
);

// ==================== POST (create rule) ====================
export const POST = withAuth(
  async (req: NextRequest, _ctx, session: Session) => {
    let customerAccountId: string;
    try {
      customerAccountId = getCustomerAccountId(session);
    } catch {
      return NextResponse.json({ error: 'No customer account assigned' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const category = (body.category || '').toString().trim();
    if (!category) return NextResponse.json({ error: 'Category is required' }, { status: 400 });

    const defaultTier = isTicketTier(body.defaultTier) ? body.defaultTier : 'L1';
    const defaultPriority = isTicketPriority(body.defaultPriority) ? body.defaultPriority : 'P3';

    // Normalize keywords to a JSON array string if provided as array or CSV.
    let keywords: string | null = null;
    if (Array.isArray(body.keywords)) {
      keywords = JSON.stringify(body.keywords.filter((k: unknown) => typeof k === 'string'));
    } else if (typeof body.keywords === 'string' && body.keywords.trim()) {
      keywords = JSON.stringify(
        body.keywords
          .split(',')
          .map((k: string) => k.trim())
          .filter(Boolean),
      );
    }

    try {
      const rule = await prisma.supportRoutingRule.create({
        data: {
          customerAccountId,
          category,
          defaultTier,
          defaultPriority,
          assignToDepartmentId: body.assignToDepartmentId ? body.assignToDepartmentId.toString() : null,
          keywords,
          isActive: body.isActive !== false,
        },
      });
      return NextResponse.json(rule, { status: 201 });
    } catch (err: unknown) {
      // Unique constraint on (customerAccountId, category)
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
        return NextResponse.json({ error: 'A rule for this category already exists' }, { status: 409 });
      }
      throw err;
    }
  },
  { resource: 'support.settings', action: 'create' },
);
