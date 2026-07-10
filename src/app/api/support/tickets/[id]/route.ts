import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  withAuth,
  validateTenantAccess,
  forbidden,
  type AuthenticatedRequest,
} from '@/lib/api-auth';
import { translateRecord } from '@/lib/translation-service';
import { logTicketActivity } from '@/lib/support/ticket-service';
import { isTicketPriority, isTicketTier, isTicketStatus } from '@/lib/support/constants';

type Session = AuthenticatedRequest['user'];

interface RouteContext {
  params: Promise<{ id: string }>;
}

const ticketInclude = {
  assignedTo: { select: { id: true, fullName: true, email: true } },
  reporter: { select: { id: true, fullName: true, email: true } },
  createdBy: { select: { id: true, fullName: true } },
  department: { select: { id: true, name: true } },
  comments: {
    orderBy: { createdAt: 'asc' as const },
    include: { user: { select: { id: true, fullName: true } } },
  },
  activities: {
    orderBy: { createdAt: 'desc' as const },
    include: { actor: { select: { id: true, fullName: true } } },
  },
} as const;

// ==================== GET ====================
export const GET = withAuth(
  async (_req: NextRequest, ctx: RouteContext, session: Session) => {
    const { id } = await ctx.params;
    const ticket = await prisma.supportTicket.findUnique({ where: { id }, include: ticketInclude });
    if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!validateTenantAccess(session, ticket.customerAccountId)) return forbidden('Access denied');
    return NextResponse.json(ticket);
  },
  { resource: 'support.tickets', action: 'view' },
);

// ==================== PATCH ====================
export const PATCH = withAuth(
  async (req: NextRequest, ctx: RouteContext, session: Session) => {
    const { id } = await ctx.params;
    const existing = await prisma.supportTicket.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!validateTenantAccess(session, existing.customerAccountId)) return forbidden('Access denied');

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    const activities: Array<{ action: string; fromValue: string; toValue: string }> = [];

    if (typeof body.subject === 'string' && body.subject.trim() && body.subject !== existing.subject) {
      data.subject = body.subject.trim();
    }
    if (typeof body.description === 'string' && body.description !== existing.description) {
      data.description = body.description;
    }
    if (typeof body.category === 'string' && body.category !== existing.category) {
      data.category = body.category;
    }
    if (isTicketPriority(body.priority) && body.priority !== existing.priority) {
      data.priority = body.priority;
      activities.push({ action: 'priority_changed', fromValue: existing.priority, toValue: body.priority });
    }
    if (isTicketTier(body.tier) && body.tier !== existing.tier) {
      data.tier = body.tier;
      activities.push({ action: 'tier_changed', fromValue: existing.tier, toValue: body.tier });
    }
    if (typeof body.severity === 'string' && body.severity && body.severity !== existing.severity) {
      data.severity = body.severity;
    }
    if ('departmentId' in body && body.departmentId !== existing.departmentId) {
      data.departmentId = body.departmentId || null;
    }

    if (isTicketStatus(body.status) && body.status !== existing.status) {
      data.status = body.status;
      activities.push({ action: 'status_changed', fromValue: existing.status, toValue: body.status });

      const now = new Date();
      // First time it leaves the New/queued state → acknowledged + first response.
      if (!existing.acknowledgedAt && body.status !== 'New') {
        data.acknowledgedAt = now;
        data.firstResponseAt = now;
      }
      if (body.status === 'Resolved' && !existing.resolvedAt) data.resolvedAt = now;
      if (body.status === 'Closed' && !existing.closedAt) data.closedAt = now;
      if (body.status === 'Reopened') {
        data.resolvedAt = null;
        data.closedAt = null;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data,
      include: ticketInclude,
    });

    for (const a of activities) {
      await logTicketActivity({ ticketId: id, actorId: session.id, ...a });
    }

    if (data.subject || data.description) {
      void translateRecord(existing.customerAccountId, 'SupportTicket', id, {
        subject: (data.subject as string) || existing.subject,
        description: (data.description as string) ?? existing.description ?? '',
      });
    }

    return NextResponse.json(ticket);
  },
  { resource: 'support.tickets', action: 'edit' },
);

// ==================== DELETE ====================
export const DELETE = withAuth(
  async (_req: NextRequest, ctx: RouteContext, session: Session) => {
    const { id } = await ctx.params;
    const existing = await prisma.supportTicket.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!validateTenantAccess(session, existing.customerAccountId)) return forbidden('Access denied');

    // Comments and activities cascade-delete via the schema relations.
    await prisma.supportTicket.delete({ where: { id } });
    return NextResponse.json({ success: true });
  },
  { resource: 'support.tickets', action: 'delete' },
);
