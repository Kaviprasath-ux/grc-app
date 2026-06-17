import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  withAuth,
  validateTenantAccess,
  forbidden,
  type AuthenticatedRequest,
} from '@/lib/api-auth';
import { logTicketActivity } from '@/lib/support/ticket-service';

type Session = AuthenticatedRequest['user'];

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Submit a CSAT rating (1-5) for a resolved/closed ticket. Only the reporter
// may rate, and only once.
export const POST = withAuth(
  async (req: NextRequest, ctx: RouteContext, session: Session) => {
    const { id } = await ctx.params;
    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!validateTenantAccess(session, ticket.customerAccountId)) return forbidden('Access denied');

    if (ticket.reporterId && ticket.reporterId !== session.id) {
      return forbidden('Only the reporter can rate this ticket');
    }
    if (ticket.status !== 'Resolved' && ticket.status !== 'Closed') {
      return NextResponse.json({ error: 'Ticket is not resolved yet' }, { status: 400 });
    }
    if (ticket.csatScore != null) {
      return NextResponse.json({ error: 'Feedback already submitted' }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const score = Number(body.csatScore);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return NextResponse.json({ error: 'Score must be an integer 1-5' }, { status: 400 });
    }
    const comment = typeof body.csatComment === 'string' ? body.csatComment.slice(0, 2000) : null;

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: { csatScore: score, csatComment: comment, csatSubmittedAt: new Date() },
    });

    await logTicketActivity({
      ticketId: id,
      actorId: session.id,
      action: 'csat_submitted',
      toValue: String(score),
    });

    return NextResponse.json({ success: true, csatScore: updated.csatScore });
  },
  { resource: 'support.tickets', action: 'view' },
);
