import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  withAuth,
  validateTenantAccess,
  forbidden,
  type AuthenticatedRequest,
} from '@/lib/api-auth';
import {
  notificationService,
  NOTIFICATION_EVENTS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PRIORITIES,
} from '@/lib/notification-service';
import { logTicketActivity } from '@/lib/support/ticket-service';
import { sendChannelReply } from '@/lib/support/channels';

type Session = AuthenticatedRequest['user'];

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ==================== GET (list comments) ====================
export const GET = withAuth(
  async (_req: NextRequest, ctx: RouteContext, session: Session) => {
    const { id } = await ctx.params;
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      select: { customerAccountId: true },
    });
    if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!validateTenantAccess(session, ticket.customerAccountId)) return forbidden('Access denied');

    const comments = await prisma.supportTicketComment.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, fullName: true } } },
    });
    return NextResponse.json({ comments });
  },
  { resource: 'support.tickets', action: 'view' },
);

// ==================== POST (add comment / reply) ====================
export const POST = withAuth(
  async (req: NextRequest, ctx: RouteContext, session: Session) => {
    const { id } = await ctx.params;
    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!validateTenantAccess(session, ticket.customerAccountId)) return forbidden('Access denied');

    const body = await req.json().catch(() => ({}));
    const text = (body.comment || '').toString().trim();
    if (!text) return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
    const isInternal = body.isInternal === true;

    const comment = await prisma.supportTicketComment.create({
      data: { ticketId: id, userId: session.id, comment: text, isInternal },
      include: { user: { select: { id: true, fullName: true } } },
    });

    // Stamp first response if this is the first agent reply.
    if (!ticket.firstResponseAt) {
      await prisma.supportTicket.update({ where: { id }, data: { firstResponseAt: new Date() } });
    }

    await logTicketActivity({
      ticketId: id,
      actorId: session.id,
      action: 'commented',
      note: isInternal ? 'Internal note' : 'Reply',
    });

    // Push customer-visible replies back out over the originating external
    // channel (WhatsApp / Teams), best-effort.
    if (!isInternal && (ticket.channel === 'WhatsApp' || ticket.channel === 'Teams') && ticket.reporterPhone) {
      void sendChannelReply({
        channel: ticket.channel,
        to: ticket.externalRef || ticket.reporterPhone,
        text,
      }).catch((err) => console.error('[support] channel reply failed', err));
    }

    // Notify the other party (assignee <-> reporter), best-effort, inbox only.
    const recipientId =
      session.id === ticket.assignedToId ? ticket.reporterId : ticket.assignedToId;
    if (recipientId && recipientId !== session.id && !isInternal) {
      void notificationService
        .send({
          customerAccountId: ticket.customerAccountId,
          actorId: session.id,
          recipientId,
          event: NOTIFICATION_EVENTS.SUPPORT_TICKET_COMMENT_ADDED,
          title: `New reply on ${ticket.ticketCode}`,
          message: text.slice(0, 140),
          relatedEntityType: 'support-ticket',
          relatedEntityId: id,
          link: `/support/tickets/${id}`,
          module: 'GRC',
          priority: NOTIFICATION_PRIORITIES.NORMAL,
          channels: [NOTIFICATION_CHANNELS.INBOX],
        })
        .catch((err) => console.error('[support] comment notify failed', err));
    }

    return NextResponse.json(comment, { status: 201 });
  },
  { resource: 'support.tickets', action: 'edit' },
);
