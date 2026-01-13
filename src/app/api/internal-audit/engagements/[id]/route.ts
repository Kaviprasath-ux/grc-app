import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

// GET /api/internal-audit/engagements/[id] - Get a single engagement
export const GET = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;

      const engagement = await prisma.auditEngagement.findUnique({
        where: { id },
        include: {
          department: {
            select: { id: true, name: true }
          }
        }
      });

      if (!engagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(engagement);
    } catch (error) {
      console.error('Error fetching engagement:', error);
      return NextResponse.json(
        { error: 'Failed to fetch engagement' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.planning', action: 'view' }
);

// PUT /api/internal-audit/engagements/[id] - Update an engagement
export const PUT = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const body = await req.json();

      const {
        engagementTitle,
        departmentId,
        auditType,
        startDate,
        endDate,
        plannedHours,
        status
      } = body;

      const engagement = await prisma.auditEngagement.update({
        where: { id },
        data: {
          engagementTitle,
          departmentId: departmentId || null,
          auditType,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          plannedHours: plannedHours || 0,
          status: status || undefined
        },
        include: {
          department: {
            select: { id: true, name: true }
          }
        }
      });

      return NextResponse.json(engagement);
    } catch (error) {
      console.error('Error updating engagement:', error);
      return NextResponse.json(
        { error: 'Failed to update engagement' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.planning', action: 'update' }
);

// DELETE /api/internal-audit/engagements/[id] - Delete an engagement
export const DELETE = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;

      await prisma.auditEngagement.delete({
        where: { id }
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error deleting engagement:', error);
      return NextResponse.json(
        { error: 'Failed to delete engagement' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.planning', action: 'delete' }
);
