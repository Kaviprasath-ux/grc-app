import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getCustomerAccountId } from '@/lib/api-auth';

const MEETING_TYPES = ['opening', 'discussion', 'closing'];

// GET /api/internal-audit/engagements/[id]/meetings - List meetings for an engagement
export const GET = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);

      // Verify engagement exists and belongs to tenant
      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true },
      });

      if (!engagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      const { searchParams } = new URL(req.url);
      const type = searchParams.get('type');

      const where: Record<string, unknown> = { engagementId: id, ...tenantFilter };
      if (type) {
        where.meetingType = type;
      }

      const meetings = await prisma.auditEngagementMeeting.findMany({
        where,
        orderBy: [
          { meetingDate: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      return NextResponse.json(meetings);
    } catch (error) {
      console.error('Error fetching engagement meetings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch engagement meetings' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

// POST /api/internal-audit/engagements/[id]/meetings - Create a meeting
export const POST = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const body = await req.json();
      const tenantFilter = getTenantFilter(session);

      // Verify engagement exists and belongs to tenant
      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true },
      });

      if (!engagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      const {
        meetingType,
        title,
        meetingDate,
        location,
        attendees,
        agenda,
        minutes,
        decisions,
        status,
      } = body;

      if (!meetingType || !MEETING_TYPES.includes(meetingType)) {
        return NextResponse.json(
          { error: 'meetingType is required and must be one of: opening, discussion, closing' },
          { status: 400 }
        );
      }

      if (!session.customerAccountId) {
        return NextResponse.json(
          { error: 'User does not have a customer account assigned' },
          { status: 400 }
        );
      }
      const customerAccountId = getCustomerAccountId(session);

      const meeting = await prisma.auditEngagementMeeting.create({
        data: {
          customerAccountId,
          engagementId: id,
          meetingType,
          title: title ?? null,
          meetingDate: meetingDate ? new Date(meetingDate) : null,
          location: location ?? null,
          attendees: attendees ?? null,
          agenda: agenda ?? null,
          minutes: minutes ?? null,
          decisions: decisions ?? null,
          status: status ?? 'Draft',
          createdById: session.id,
          createdByName: session.name || null,
        },
      });

      return NextResponse.json(meeting, { status: 201 });
    } catch (error) {
      console.error('Error creating engagement meeting:', error);
      return NextResponse.json(
        { error: 'Failed to create engagement meeting' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);
