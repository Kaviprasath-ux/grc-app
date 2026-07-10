import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth, getTenantFilter, type AuthenticatedRequest } from '@/lib/api-auth';
import { OPEN_TICKET_STATUSES } from '@/lib/support/constants';

type Session = AuthenticatedRequest['user'];

// Support KPI metrics (item 12). Aggregates the tenant's tickets over a window
// (default 90 days) and computes counts, average response/resolution times,
// SLA breaches and CSAT. Computed in JS over a lightweight projection.
export const GET = withAuth(
  async (req: NextRequest, _ctx, session: Session) => {
    const { searchParams } = new URL(req.url);
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get('days') || '90', 10)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const now = new Date();

    const tickets = await prisma.supportTicket.findMany({
      where: { ...getTenantFilter(session), createdAt: { gte: since } },
      select: {
        priority: true,
        tier: true,
        status: true,
        channel: true,
        createdAt: true,
        firstResponseAt: true,
        resolvedAt: true,
        slaResolveDeadline: true,
        csatScore: true,
      },
    });

    const openSet = new Set(OPEN_TICKET_STATUSES as unknown as string[]);
    const tally = (key: 'priority' | 'tier' | 'status' | 'channel') =>
      tickets.reduce<Record<string, number>>((acc, x) => {
        const v = x[key] || 'Unknown';
        acc[v] = (acc[v] || 0) + 1;
        return acc;
      }, {});

    let frSum = 0, frN = 0, resSum = 0, resN = 0, breaches = 0, csatSum = 0, csatN = 0, botCreated = 0;
    for (const x of tickets) {
      if (x.firstResponseAt) {
        frSum += (x.firstResponseAt.getTime() - x.createdAt.getTime()) / 60000;
        frN++;
      }
      if (x.resolvedAt) {
        resSum += (x.resolvedAt.getTime() - x.createdAt.getTime()) / 60000;
        resN++;
      }
      // SLA breach: resolved late, or still open past the deadline.
      if (x.slaResolveDeadline) {
        if (x.resolvedAt) {
          if (x.resolvedAt > x.slaResolveDeadline) breaches++;
        } else if (x.slaResolveDeadline < now) {
          breaches++;
        }
      }
      if (x.csatScore != null) {
        csatSum += x.csatScore;
        csatN++;
      }
      if (x.channel === 'Chatbot') botCreated++;
    }

    const total = tickets.length;
    const open = tickets.filter((x) => openSet.has(x.status)).length;
    const resolved = tickets.filter((x) => x.status === 'Resolved' || x.status === 'Closed').length;

    return NextResponse.json({
      window: { days, since: since.toISOString() },
      totals: { total, open, resolved },
      byPriority: tally('priority'),
      byTier: tally('tier'),
      byStatus: tally('status'),
      byChannel: tally('channel'),
      avgFirstResponseMins: frN ? Math.round(frSum / frN) : null,
      avgResolutionMins: resN ? Math.round(resSum / resN) : null,
      slaBreaches: breaches,
      slaCompliancePct: total ? Math.round(((total - breaches) / total) * 100) : null,
      csat: { average: csatN ? Math.round((csatSum / csatN) * 10) / 10 : null, responses: csatN },
      // Chatbot-originated tickets are escalations the bot could NOT resolve;
      // a low share indicates good auto-resolution.
      chatbotEscalations: botCreated,
    });
  },
  { resource: 'support.dashboard', action: 'view' },
);
