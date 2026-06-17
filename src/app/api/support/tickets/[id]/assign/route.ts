import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  withAuth,
  validateTenantAccess,
  forbidden,
  type AuthenticatedRequest,
} from '@/lib/api-auth';
import { logTicketActivity, notifyTicketAssigned } from '@/lib/support/ticket-service';

type Session = AuthenticatedRequest['user'];

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Assign / reassign a ticket to an agent (or unassign with assignedToId = null).
export const POST = withAuth(
  async (req: NextRequest, ctx: RouteContext, session: Session) => {
    const { id } = await ctx.params;
    const existing = await prisma.supportTicket.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!validateTenantAccess(session, existing.customerAccountId)) return forbidden('Access denied');

    const body = await req.json().catch(() => ({}));
    const assignedToId: string | null = body.assignedToId ? body.assignedToId.toString() : null;

    if (assignedToId) {
      // Guard: the assignee must belong to the same tenant.
      const assignee = await prisma.user.findUnique({
        where: { id: assignedToId },
        select: { customerAccountId: true },
      });
      if (!assignee || assignee.customerAccountId !== existing.customerAccountId) {
        return NextResponse.json({ error: 'Invalid assignee' }, { status: 400 });
      }
    }

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: { assignedToId },
      include: {
        assignedTo: { select: { id: true, fullName: true, email: true } },
        reporter: { select: { id: true, fullName: true, email: true } },
        department: { select: { id: true, name: true } },
      },
    });

    await logTicketActivity({
      ticketId: id,
      actorId: session.id,
      action: 'assigned',
      fromValue: existing.assignedToId,
      toValue: assignedToId,
    });

    if (assignedToId) {
      void notifyTicketAssigned({
        customerAccountId: existing.customerAccountId,
        actorId: session.id,
        assigneeId: assignedToId,
        ticketId: id,
        ticketCode: existing.ticketCode,
        subject: existing.subject,
        priority: existing.priority,
      });
    }

    return NextResponse.json(ticket);
  },
  { resource: 'support.tickets', action: 'edit' },
);
