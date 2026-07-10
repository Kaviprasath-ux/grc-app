import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  withAuth,
  getTenantFilter,
  getCustomerAccountId,
  type AuthenticatedRequest,
} from '@/lib/api-auth';
import { translateRecord } from '@/lib/translation-service';
import { NOTIFICATION_EVENTS } from '@/lib/notification-service';
import { classifyTicket } from '@/lib/support/classify-ticket';
import {
  generateTicketCode,
  getTicketScopeWhere,
  logTicketActivity,
  notifyTicketAssigned,
  notifyTierQueue,
} from '@/lib/support/ticket-service';
import {
  isTicketPriority,
  isTicketTier,
  isTicketStatus,
  isTicketChannel,
  OPEN_TICKET_STATUSES,
  type TicketTier,
} from '@/lib/support/constants';

type Session = AuthenticatedRequest['user'];

const ticketInclude = {
  assignedTo: { select: { id: true, fullName: true, email: true } },
  reporter: { select: { id: true, fullName: true, email: true } },
  department: { select: { id: true, name: true } },
  _count: { select: { comments: true } },
} as const;

// ==================== GET (list) ====================
export const GET = withAuth(
  async (req: NextRequest, _ctx, session: Session) => {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status') || '';
    const priority = searchParams.get('priority') || '';
    const tier = searchParams.get('tier') || '';
    const category = searchParams.get('category') || '';
    const channel = searchParams.get('channel') || '';
    const queue = searchParams.get('queue') || ''; // mine | unassigned | open | all
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10)));

    const where: Record<string, unknown> = {
      ...getTenantFilter(session),
      ...getTicketScopeWhere(session),
    };

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (tier) where.tier = tier;
    if (category) where.category = category;
    if (channel) where.channel = channel;

    if (queue === 'mine') where.assignedToId = session.id;
    else if (queue === 'unassigned') where.assignedToId = null;
    else if (queue === 'open') where.status = { in: OPEN_TICKET_STATUSES as unknown as string[] };

    if (search) {
      where.AND = [
        {
          OR: [
            { subject: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { ticketCode: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: ticketInclude,
        // Priority then nearest resolution deadline, newest first as a tiebreak.
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return NextResponse.json({
      tickets,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  },
  { resource: 'support.tickets', action: 'view' },
);

// ==================== POST (create) ====================
export const POST = withAuth(
  async (req: NextRequest, _ctx, session: Session) => {
    let customerAccountId: string;
    try {
      customerAccountId = getCustomerAccountId(session);
    } catch {
      return NextResponse.json({ error: 'No customer account assigned' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const subject = (body.subject || '').toString().trim();
    if (!subject) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }
    const description = body.description ? body.description.toString() : null;
    const category = body.category ? body.category.toString() : null;
    const subcategory = body.subcategory ? body.subcategory.toString() : null;
    const channel = isTicketChannel(body.channel) ? body.channel : 'InApp';

    // Auto-classify (priority/tier/severity/SLA), then apply any valid overrides.
    const rules = await prisma.supportRoutingRule.findMany({ where: { customerAccountId } });
    const classified = classifyTicket({ subject, description, category }, rules);

    const priority = isTicketPriority(body.priority) ? body.priority : classified.priority;
    const tier: TicketTier = isTicketTier(body.tier) ? body.tier : classified.tier;
    const severity = typeof body.severity === 'string' && body.severity ? body.severity : classified.severity;
    const departmentId = body.departmentId ? body.departmentId.toString() : classified.departmentId;
    const assignedToId = body.assignedToId ? body.assignedToId.toString() : null;

    const ticketCode = await generateTicketCode(customerAccountId);

    const ticket = await prisma.supportTicket.create({
      data: {
        customerAccountId,
        ticketCode,
        subject,
        description,
        category,
        subcategory,
        channel,
        priority,
        severity,
        tier,
        status: 'New',
        departmentId,
        assignedToId,
        reporterId: body.reporterId ? body.reporterId.toString() : session.id,
        reporterName: body.reporterName ? body.reporterName.toString() : session.name,
        reporterEmail: body.reporterEmail ? body.reporterEmail.toString() : session.email,
        slaAckDeadline: classified.slaAckDeadline,
        slaResolveDeadline: classified.slaResolveDeadline,
        createdById: session.id,
      },
      include: ticketInclude,
    });

    await logTicketActivity({
      ticketId: ticket.id,
      actorId: session.id,
      action: 'created',
      note: classified.p1KeywordHit ? 'Auto-classified P1 (critical keyword)' : `Auto-classified ${priority}/${tier}`,
    });

    // Notify assignee directly, else the tier queue.
    if (assignedToId) {
      void notifyTicketAssigned({
        customerAccountId,
        actorId: session.id,
        assigneeId: assignedToId,
        ticketId: ticket.id,
        ticketCode,
        subject,
        priority,
      });
    } else {
      void notifyTierQueue({
        customerAccountId,
        actorId: session.id,
        tier,
        ticketId: ticket.id,
        ticketCode,
        subject,
        priority,
        event: NOTIFICATION_EVENTS.SUPPORT_TICKET_CREATED,
      });
    }

    void translateRecord(customerAccountId, 'SupportTicket', ticket.id, {
      subject,
      description: description || '',
    });

    return NextResponse.json(ticket, { status: 201 });
  },
  { resource: 'support.tickets', action: 'create' },
);
