import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuthOnly, type AuthenticatedRequest } from '@/lib/api-auth';
import { translateRecord } from '@/lib/translation-service';
import { NOTIFICATION_EVENTS } from '@/lib/notification-service';
import { classifyTicket } from '@/lib/support/classify-ticket';
import {
  generateTicketCode,
  logTicketActivity,
  notifyTierQueue,
} from '@/lib/support/ticket-service';
import { ESCALATION_REASONS, type EscalationReason } from '@/lib/support/constants';

type Session = AuthenticatedRequest['user'];

/**
 * Create a support ticket from the AI Help Chatbot when it cannot resolve a
 * question. Any authenticated user can call this (the reporter is the current
 * user). Wired from the chatbot's "Create support ticket" action.
 *
 * Body: { subject, description?, conversationId?, transcript?, reason? }
 */
export const POST = withAuthOnly(async (req: NextRequest, _ctx, session: Session) => {
  if (!session.customerAccountId) {
    return NextResponse.json({ error: 'No customer account assigned' }, { status: 400 });
  }
  const customerAccountId = session.customerAccountId;

  const body = await req.json().catch(() => ({}));
  const subject = (body.subject || '').toString().trim().slice(0, 300);
  if (!subject) return NextResponse.json({ error: 'Subject is required' }, { status: 400 });

  const description = body.description ? body.description.toString() : null;
  const reason: EscalationReason = (ESCALATION_REASONS as readonly string[]).includes(body.reason)
    ? body.reason
    : 'low_confidence';

  // Transcript may arrive as an array of {role, content}; store as JSON string.
  let botTranscript: string | null = null;
  if (body.transcript != null) {
    const raw =
      typeof body.transcript === 'string' ? body.transcript : JSON.stringify(body.transcript);
    botTranscript = raw.length > 20000 ? raw.slice(0, 20000) : raw;
  }

  const rules = await prisma.supportRoutingRule.findMany({ where: { customerAccountId } });
  const classified = classifyTicket({ subject, description, category: null }, rules);

  const ticketCode = await generateTicketCode(customerAccountId);

  const ticket = await prisma.supportTicket.create({
    data: {
      customerAccountId,
      ticketCode,
      subject,
      description,
      channel: 'Chatbot',
      priority: classified.priority,
      severity: classified.severity,
      tier: classified.tier,
      status: 'New',
      departmentId: classified.departmentId,
      reporterId: session.id,
      reporterName: session.name,
      reporterEmail: session.email,
      originConversationId: body.conversationId ? body.conversationId.toString() : null,
      botTranscript,
      escalationReason: reason,
      slaAckDeadline: classified.slaAckDeadline,
      slaResolveDeadline: classified.slaResolveDeadline,
      createdById: session.id,
    },
  });

  await logTicketActivity({
    ticketId: ticket.id,
    actorId: session.id,
    action: 'created',
    note: `Escalated from AI chatbot (${reason})`,
  });

  void notifyTierQueue({
    customerAccountId,
    actorId: session.id,
    tier: classified.tier,
    ticketId: ticket.id,
    ticketCode,
    subject,
    priority: classified.priority,
    event: NOTIFICATION_EVENTS.SUPPORT_TICKET_CREATED,
  });

  void translateRecord(customerAccountId, 'SupportTicket', ticket.id, {
    subject,
    description: description || '',
  });

  return NextResponse.json(
    { id: ticket.id, ticketCode: ticket.ticketCode, priority: ticket.priority, tier: ticket.tier },
    { status: 201 },
  );
});
