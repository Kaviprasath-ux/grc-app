import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  notificationService,
  NOTIFICATION_EVENTS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PRIORITIES,
} from '@/lib/notification-service';
import { startCronRun, finishCronRun } from '@/lib/cron-logger';
import { OPEN_TICKET_STATUSES } from '@/lib/support/constants';

/**
 * Support SLA checker (item 10).
 *
 * Runs frequently (every 15 min). For each open ticket:
 *   - acknowledgement SLA: not acknowledged and past slaAckDeadline
 *   - resolution SLA:      not resolved and past slaResolveDeadline
 * Fires a one-time warning/breach notification to the assignee (or the tier
 * queue if unassigned) plus support managers, using dedupe fields so an alert
 * is sent at most once per deadline.
 *
 * Security: protected by CRON_SECRET when set.
 */

const TIER_ROLE: Record<string, string> = {
  L1: 'SupportAgentL1',
  L2: 'SupportSpecialistL2',
  L3: 'SupportEngineerL3',
  L4: 'SupportManager',
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const counts = { ackBreached: 0, resolveBreached: 0 };
  const errors: Array<{ ticketId: string; error: string }> = [];
  const triggeredBy = req.headers.get('x-triggered-by') === 'manual' ? 'manual' : 'schedule';
  const runId = await startCronRun({ taskFunction: 'ticket-sla', name: 'Support SLA', schedule: '*/15 * * * *', triggeredBy });

  try {
    // Candidate tickets: still open, with a deadline already past, not yet alerted for it.
    const tickets = await prisma.supportTicket.findMany({
      where: {
        status: { in: OPEN_TICKET_STATUSES as unknown as string[] },
        OR: [
          { acknowledgedAt: null, slaAckDeadline: { lt: now }, slaAckAlertedAt: null },
          { resolvedAt: null, slaResolveDeadline: { lt: now }, slaResolveAlertedAt: null },
        ],
      },
      select: {
        id: true,
        customerAccountId: true,
        ticketCode: true,
        subject: true,
        priority: true,
        tier: true,
        assignedToId: true,
        acknowledgedAt: true,
        resolvedAt: true,
        slaAckDeadline: true,
        slaResolveDeadline: true,
        slaAckAlertedAt: true,
        slaResolveAlertedAt: true,
      },
    });

    // Cache role-holder lookups per (customerAccountId, tier) within this run.
    const queueCache = new Map<string, string[]>();
    const getQueue = async (customerAccountId: string, tier: string): Promise<string[]> => {
      const key = `${customerAccountId}:${tier}`;
      if (queueCache.has(key)) return queueCache.get(key)!;
      const roleNames = [TIER_ROLE[tier] || 'SupportManager', 'SupportManager'];
      const users = await prisma.user.findMany({
        where: { customerAccountId, isActive: true, userRoles: { some: { role: { name: { in: roleNames } } } } },
        select: { id: true },
      });
      const ids = users.map((u) => u.id);
      queueCache.set(key, ids);
      return ids;
    };

    for (const ticket of tickets) {
      try {
        const ackBreach = !ticket.acknowledgedAt && ticket.slaAckDeadline && ticket.slaAckDeadline < now && !ticket.slaAckAlertedAt;
        const resolveBreach = !ticket.resolvedAt && ticket.slaResolveDeadline && ticket.slaResolveDeadline < now && !ticket.slaResolveAlertedAt;
        if (!ackBreach && !resolveBreach) continue;

        const kind = ackBreach ? 'acknowledgement' : 'resolution';
        const recipientIds = ticket.assignedToId
          ? [ticket.assignedToId]
          : await getQueue(ticket.customerAccountId, ticket.tier);
        if (recipientIds.length === 0) {
          // Still mark as alerted to avoid re-scanning forever.
        } else {
          await notificationService.sendBulk({
            customerAccountId: ticket.customerAccountId,
            actorId: 'system',
            recipientIds,
            event: NOTIFICATION_EVENTS.SUPPORT_TICKET_SLA_BREACHED,
            title: `SLA breached on ${ticket.ticketCode} (${kind})`,
            message: `[${ticket.priority}] ${ticket.subject}`,
            relatedEntityType: 'support-ticket',
            relatedEntityId: ticket.id,
            link: `/support/tickets/${ticket.id}`,
            module: 'GRC',
            priority: NOTIFICATION_PRIORITIES.URGENT,
            channels: [NOTIFICATION_CHANNELS.INBOX],
            metadata: { ticketCode: ticket.ticketCode, slaKind: kind },
          });
        }

        await prisma.supportTicket.update({
          where: { id: ticket.id },
          data: ackBreach ? { slaAckAlertedAt: now } : { slaResolveAlertedAt: now },
        });
        if (ackBreach) counts.ackBreached++;
        else counts.resolveBreached++;
      } catch (e) {
        errors.push({ ticketId: ticket.id, error: e instanceof Error ? e.message : 'unknown' });
      }
    }

    const total = counts.ackBreached + counts.resolveBreached;
    await finishCronRun(runId, 'Completed', { counts, errorCount: errors.length }, `Processed ${total} SLA breach alert(s)`);
    return NextResponse.json({ success: true, counts, errors, timestamp: now.toISOString() });
  } catch (error) {
    await finishCronRun(runId, 'Failed', { error: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'unknown' }, { status: 500 });
  }
}
