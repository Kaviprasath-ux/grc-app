import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter } from '@/lib/api-auth';

// GET /api/internal-audit/engagements/[id]/meetings/[meetingId] - Get a single meeting
export const GET = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string; meetingId: string }> }, session) => {
    try {
      const { id, meetingId } = await params;
      const tenantFilter = getTenantFilter(session);

      const meeting = await prisma.auditEngagementMeeting.findFirst({
        where: { id: meetingId, engagementId: id, ...tenantFilter },
      });

      if (!meeting) {
        return NextResponse.json(
          { error: 'Meeting not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(meeting);
    } catch (error) {
      console.error('Error fetching engagement meeting:', error);
      return NextResponse.json(
        { error: 'Failed to fetch engagement meeting' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

// PATCH /api/internal-audit/engagements/[id]/meetings/[meetingId] - Partial update a meeting
export const PATCH = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string; meetingId: string }> }, session) => {
    try {
      const { id, meetingId } = await params;
      const body = await req.json();
      const tenantFilter = getTenantFilter(session);

      // Verify meeting exists and belongs to tenant
      const existingMeeting = await prisma.auditEngagementMeeting.findFirst({
        where: { id: meetingId, engagementId: id, ...tenantFilter },
        select: { id: true },
      });

      if (!existingMeeting) {
        return NextResponse.json(
          { error: 'Meeting not found' },
          { status: 404 }
        );
      }

      const updateData: Record<string, unknown> = {};

      if (body.title !== undefined) updateData.title = body.title;
      if (body.meetingDate !== undefined) {
        updateData.meetingDate = body.meetingDate ? new Date(body.meetingDate) : null;
      }
      if (body.location !== undefined) updateData.location = body.location;
      if (body.attendees !== undefined) updateData.attendees = body.attendees;
      if (body.agenda !== undefined) updateData.agenda = body.agenda;
      if (body.minutes !== undefined) updateData.minutes = body.minutes;
      if (body.decisions !== undefined) updateData.decisions = body.decisions;
      if (body.status !== undefined) updateData.status = body.status;

      const meeting = await prisma.auditEngagementMeeting.update({
        where: { id: meetingId },
        data: updateData,
      });

      return NextResponse.json(meeting);
    } catch (error) {
      console.error('Error updating engagement meeting:', error);
      return NextResponse.json(
        { error: 'Failed to update engagement meeting' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);

// DELETE /api/internal-audit/engagements/[id]/meetings/[meetingId] - Delete a meeting
export const DELETE = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string; meetingId: string }> }, session) => {
    try {
      const { id, meetingId } = await params;
      const tenantFilter = getTenantFilter(session);

      // Verify meeting exists and belongs to tenant
      const existingMeeting = await prisma.auditEngagementMeeting.findFirst({
        where: { id: meetingId, engagementId: id, ...tenantFilter },
        select: { id: true },
      });

      if (!existingMeeting) {
        return NextResponse.json(
          { error: 'Meeting not found' },
          { status: 404 }
        );
      }

      await prisma.auditEngagementMeeting.delete({
        where: { id: meetingId },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error deleting engagement meeting:', error);
      return NextResponse.json(
        { error: 'Failed to delete engagement meeting' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);
