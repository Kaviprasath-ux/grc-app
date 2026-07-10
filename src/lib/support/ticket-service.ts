/**
 * Support Ticketing — server-side service helpers.
 *
 * Shared by the support API routes: ticket-code generation, role-scoped
 * visibility filters, activity logging and notification fan-out. Notifications
 * are best-effort (wrapped so a failure never breaks the ticket operation).
 */

import prisma from '@/lib/prisma';
import { getPermissionScope } from '@/lib/permissions';
import type { AuthenticatedRequest } from '@/lib/api-auth';
import {
  notificationService,
  NOTIFICATION_EVENTS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PRIORITIES,
} from '@/lib/notification-service';
import type { TicketTier } from './constants';

type Session = AuthenticatedRequest['user'];

/** Generate the next human-readable ticket code (TKT-001) for a tenant. */
export async function generateTicketCode(customerAccountId: string): Promise<string> {
  const tickets = await prisma.supportTicket.findMany({
    where: { customerAccountId },
    select: { ticketCode: true },
  });

  let maxNumber = 0;
  for (const t of tickets) {
    const match = t.ticketCode.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) maxNumber = num;
    }
  }
  return `TKT-${String(maxNumber + 1).padStart(3, '0')}`;
}

/**
 * Build the visibility WHERE clause for ticket lists/reads based on the user's
 * permission scope. Unlike getDataScopeFilter (which assumes an `ownerId`
 * column), tickets scope "own" to assigned-to / reporter / created-by.
 */
export function getTicketScopeWhere(session: Session): Record<string, unknown> {
  const scope = getPermissionScope(session.permissions, 'support.tickets', 'view');

  // 'all' (and managers) — no extra restriction beyond the tenant filter.
  if (scope === 'all' || scope === null) return {};

  if (scope === 'department') {
    return session.departmentId ? { departmentId: session.departmentId } : {};
  }

  // 'own' — tickets I'm assigned, I reported, or I created.
  return {
    OR: [
      { assignedToId: session.id },
      { reporterId: session.id },
      { createdById: session.id },
    ],
  };
}

/** Record one entry in the ticket activity trail (best-effort). */
export async function logTicketActivity(params: {
  ticketId: string;
  actorId: string | null;
  action: string;
  fromValue?: string | null;
  toValue?: string | null;
  note?: string | null;
}): Promise<void> {
  try {
    await prisma.supportTicketActivity.create({
      data: {
        ticketId: params.ticketId,
        actorId: params.actorId,
        action: params.action,
        fromValue: params.fromValue ?? null,
        toValue: params.toValue ?? null,
        note: params.note ?? null,
      },
    });
  } catch (err) {
    console.error('[support] failed to log ticket activity', err);
  }
}

/** Map a tier to the support role(s) whose holders should be notified. */
const TIER_ROLE: Record<TicketTier, string> = {
  L1: 'SupportAgentL1',
  L2: 'SupportSpecialistL2',
  L3: 'SupportEngineerL3',
  L4: 'SupportManager',
};

/**
 * Find active user IDs in a tenant who hold any of the given role names.
 * Used to notify "the L2 queue" when a ticket lands unassigned at a tier.
 */
async function getUserIdsByRoles(customerAccountId: string, roleNames: string[]): Promise<string[]> {
  if (roleNames.length === 0) return [];
  const users = await prisma.user.findMany({
    where: {
      customerAccountId,
      isActive: true,
      userRoles: { some: { role: { name: { in: roleNames } } } },
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** Notify the assigned agent that a ticket was assigned to them. */
export async function notifyTicketAssigned(params: {
  customerAccountId: string;
  actorId: string;
  assigneeId: string;
  ticketId: string;
  ticketCode: string;
  subject: string;
  priority: string;
}): Promise<void> {
  try {
    await notificationService.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.assigneeId,
      event: NOTIFICATION_EVENTS.SUPPORT_TICKET_ASSIGNED,
      title: `Support ticket ${params.ticketCode} assigned to you`,
      message: `[${params.priority}] ${params.subject}`,
      relatedEntityType: 'support-ticket',
      relatedEntityId: params.ticketId,
      link: `/support/tickets/${params.ticketId}`,
      module: 'GRC',
      priority:
        params.priority === 'P1'
          ? NOTIFICATION_PRIORITIES.URGENT
          : NOTIFICATION_PRIORITIES.HIGH,
      channels: [NOTIFICATION_CHANNELS.INBOX],
      metadata: { ticketCode: params.ticketCode, priority: params.priority },
    });
  } catch (err) {
    console.error('[support] notifyTicketAssigned failed', err);
  }
}

/**
 * Notify the queue for a tier (all role-holders) that a new/escalated ticket
 * needs picking up. Skips when there's a specific assignee (handled by
 * notifyTicketAssigned instead).
 */
export async function notifyTierQueue(params: {
  customerAccountId: string;
  actorId: string;
  tier: TicketTier;
  ticketId: string;
  ticketCode: string;
  subject: string;
  priority: string;
  event: typeof NOTIFICATION_EVENTS[keyof typeof NOTIFICATION_EVENTS];
}): Promise<void> {
  try {
    // Notify the tier's role-holders plus managers, minus the actor.
    const roleNames = [TIER_ROLE[params.tier], 'SupportManager'];
    const recipientIds = (await getUserIdsByRoles(params.customerAccountId, roleNames)).filter(
      (id) => id !== params.actorId,
    );
    if (recipientIds.length === 0) return;

    await notificationService.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientIds,
      event: params.event,
      title: `Support ticket ${params.ticketCode} needs attention (${params.tier})`,
      message: `[${params.priority}] ${params.subject}`,
      relatedEntityType: 'support-ticket',
      relatedEntityId: params.ticketId,
      link: `/support/tickets/${params.ticketId}`,
      module: 'GRC',
      priority:
        params.priority === 'P1'
          ? NOTIFICATION_PRIORITIES.URGENT
          : NOTIFICATION_PRIORITIES.HIGH,
      channels: [NOTIFICATION_CHANNELS.INBOX],
      metadata: { ticketCode: params.ticketCode, priority: params.priority, tier: params.tier },
    });
  } catch (err) {
    console.error('[support] notifyTierQueue failed', err);
  }
}
