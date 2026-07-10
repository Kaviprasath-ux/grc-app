import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  withAuth,
  validateTenantAccess,
  forbidden,
  type AuthenticatedRequest,
} from '@/lib/api-auth';
import { NOTIFICATION_EVENTS } from '@/lib/notification-service';
import { logTicketActivity, notifyTierQueue } from '@/lib/support/ticket-service';
import { nextTier } from '@/lib/support/constants';

type Session = AuthenticatedRequest['user'];

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Escalate a ticket to the next tier (L1->L2->L3->L4) and return it to that
// tier's queue (clears the current assignee so the new tier picks it up).
export const POST = withAuth(
  async (req: NextRequest, ctx: RouteContext, session: Session) => {
    const { id } = await ctx.params;
    const existing = await prisma.supportTicket.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!validateTenantAccess(session, existing.customerAccountId)) return forbidden('Access denied');

    const body = await req.json().catch(() => ({}));
    const note: string | null = body.note ? body.note.toString() : null;
    const target = nextTier(existing.tier);

    if (target === existing.tier) {
      return NextResponse.json({ error: 'Ticket is already at the highest tier' }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: {
        tier: target,
        assignedToId: null,
        status: existing.status === 'New' ? 'Open' : existing.status,
      },
      include: {
        assignedTo: { select: { id: true, fullName: true, email: true } },
        reporter: { select: { id: true, fullName: true, email: true } },
        department: { select: { id: true, name: true } },
      },
    });

    await logTicketActivity({
      ticketId: id,
      actorId: session.id,
      action: 'escalated',
      fromValue: existing.tier,
      toValue: target,
      note,
    });

    void notifyTierQueue({
      customerAccountId: existing.customerAccountId,
      actorId: session.id,
      tier: target,
      ticketId: id,
      ticketCode: existing.ticketCode,
      subject: existing.subject,
      priority: existing.priority,
      event: NOTIFICATION_EVENTS.SUPPORT_TICKET_ESCALATED,
    });

    return NextResponse.json(ticket);
  },
  { resource: 'support.tickets', action: 'edit' },
);
