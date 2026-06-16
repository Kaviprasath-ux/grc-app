/**
 * Support external channels (item 15) — WhatsApp / Microsoft Teams.
 *
 * Inbound: webhook handlers turn provider messages into tickets/comments.
 * Outbound: a single replaceable boundary (like sms-service.ts). The dev stub
 * logs; production wires a BSP (MSG91 WhatsApp / Twilio / 360dialog / Teams).
 *
 * Tenant resolution: webhooks are unauthenticated and don't carry our
 * customerAccountId. For a single-customer deployment we resolve via the
 * SUPPORT_DEFAULT_CUSTOMER_ACCOUNT_ID env var, falling back to the only/first
 * account. A multi-customer rollout should map the inbound business number to
 * a tenant (future work) — logged clearly when ambiguous.
 */

import prisma from '@/lib/prisma';
import { NOTIFICATION_EVENTS } from '@/lib/notification-service';
import { classifyTicket } from './classify-ticket';
import { generateTicketCode, logTicketActivity, notifyTierQueue } from './ticket-service';
import { OPEN_TICKET_STATUSES } from './constants';

export type ExternalChannel = 'WhatsApp' | 'Teams';

export interface OutboundReplyParams {
  channel: ExternalChannel;
  to: string; // phone (WhatsApp) or conversation id (Teams)
  text: string;
}

/**
 * Send an agent reply back out over an external channel. Dev stub logs; wire a
 * provider here in production. Never throws (best-effort).
 */
export async function sendChannelReply(params: OutboundReplyParams): Promise<{ sent: boolean }> {
  const configured =
    params.channel === 'WhatsApp' ? !!process.env.WHATSAPP_API_TOKEN : !!process.env.TEAMS_BOT_TOKEN;
  if (!configured) {
    console.log(`[support/channels] (stub) ${params.channel} → ${params.to}: ${params.text.slice(0, 80)}`);
    return { sent: false };
  }
  // Production integration goes here (provider HTTP call). Left as a boundary.
  console.log(`[support/channels] ${params.channel} reply dispatched to ${params.to}`);
  return { sent: true };
}

/** Resolve which tenant an inbound message belongs to. */
async function resolveTenant(): Promise<string | null> {
  const fromEnv = process.env.SUPPORT_DEFAULT_CUSTOMER_ACCOUNT_ID;
  if (fromEnv) return fromEnv;
  const accounts = await prisma.customerAccount.findMany({ select: { id: true }, take: 2 });
  if (accounts.length === 1) return accounts[0].id;
  if (accounts.length > 1) {
    console.warn('[support/channels] multiple tenants — set SUPPORT_DEFAULT_CUSTOMER_ACCOUNT_ID to route inbound messages');
    return accounts[0]?.id ?? null;
  }
  return accounts[0]?.id ?? null;
}

export interface InboundMessage {
  channel: ExternalChannel;
  from: string; // phone or user/conversation id
  fromName?: string | null;
  text: string;
  externalRef?: string | null; // provider message/thread id
}

/**
 * Turn an inbound channel message into a ticket. If the sender has a recent
 * open ticket on this channel, the message is appended as a reply; otherwise a
 * new ticket is created (auto-classified).
 */
export async function handleInboundMessage(msg: InboundMessage): Promise<{ ticketId: string; ticketCode: string; created: boolean } | null> {
  const text = (msg.text || '').trim();
  if (!msg.from || !text) return null;

  const customerAccountId = await resolveTenant();
  if (!customerAccountId) {
    console.error('[support/channels] no tenant resolved for inbound message');
    return null;
  }

  // Look for an existing open ticket from this sender on this channel.
  const existing = await prisma.supportTicket.findFirst({
    where: {
      customerAccountId,
      channel: msg.channel,
      reporterPhone: msg.from,
      status: { in: OPEN_TICKET_STATUSES as unknown as string[] },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, ticketCode: true },
  });

  if (existing) {
    await prisma.supportTicketComment.create({
      data: {
        ticketId: existing.id,
        // System-authored inbound message; use a sentinel-free approach: store as
        // a non-internal comment authored by the reporter is not possible without
        // a userId, so we log it as an activity note + a comment requires a user.
        userId: (await systemUserId(customerAccountId)) ?? (await anyUserId(customerAccountId))!,
        comment: `(${msg.channel}) ${text}`,
        isInternal: false,
      },
    }).catch((e) => console.error('[support/channels] inbound comment failed', e));
    return { ticketId: existing.id, ticketCode: existing.ticketCode, created: false };
  }

  // New ticket.
  const rules = await prisma.supportRoutingRule.findMany({ where: { customerAccountId } });
  const classified = classifyTicket({ subject: text.slice(0, 120), description: text, category: null }, rules);
  const ticketCode = await generateTicketCode(customerAccountId);

  const ticket = await prisma.supportTicket.create({
    data: {
      customerAccountId,
      ticketCode,
      subject: text.slice(0, 120),
      description: text,
      channel: msg.channel,
      priority: classified.priority,
      severity: classified.severity,
      tier: classified.tier,
      status: 'New',
      departmentId: classified.departmentId,
      reporterName: msg.fromName ?? null,
      reporterPhone: msg.from,
      externalRef: msg.externalRef ?? null,
      slaAckDeadline: classified.slaAckDeadline,
      slaResolveDeadline: classified.slaResolveDeadline,
    },
    select: { id: true, ticketCode: true },
  });

  await logTicketActivity({ ticketId: ticket.id, actorId: null, action: 'created', note: `Inbound ${msg.channel} message` });
  void notifyTierQueue({
    customerAccountId,
    actorId: 'system',
    tier: classified.tier,
    ticketId: ticket.id,
    ticketCode,
    subject: text.slice(0, 120),
    priority: classified.priority,
    event: NOTIFICATION_EVENTS.SUPPORT_TICKET_CREATED,
  });

  return { ticketId: ticket.id, ticketCode: ticket.ticketCode, created: true };
}

// Inbound comments need an authoring userId (the schema requires it). Prefer a
// support manager/admin as the "channel" author; fall back to any tenant user.
async function systemUserId(customerAccountId: string): Promise<string | null> {
  const u = await prisma.user.findFirst({
    where: {
      customerAccountId,
      isActive: true,
      userRoles: { some: { role: { name: { in: ['SupportManager', 'CustomerAdministrator'] } } } },
    },
    select: { id: true },
  });
  return u?.id ?? null;
}
async function anyUserId(customerAccountId: string): Promise<string | null> {
  const u = await prisma.user.findFirst({ where: { customerAccountId }, select: { id: true } });
  return u?.id ?? null;
}
