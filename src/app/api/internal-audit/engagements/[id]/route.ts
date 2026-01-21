import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

// GET /api/internal-audit/engagements/[id] - Get a single engagement
// Uses audit.fieldwork:view to allow auditees to view engagement details
export const GET = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;

      const engagement = await prisma.auditEngagement.findUnique({
        where: { id },
        include: {
          department: {
            select: { id: true, name: true }
          },
          assignedAuditor: {
            select: { id: true, firstName: true, lastName: true }
          },
          auditee: {
            select: { id: true, firstName: true, lastName: true }
          },
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
  { resource: 'audit.fieldwork', action: 'view' }
);

// PUT /api/internal-audit/engagements/[id] - Update an engagement
export const PUT = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const body = await req.json();

      const {
        engagementTitle,
        engagementObjective,
        engagementScope,
        departmentId,
        auditType,
        auditRating,
        auditorId,
        auditeeId,
        startDate,
        targetDate,
        plannedHours,
        initialObservation,
        relatedPolicies,
        status,
        tasks
      } = body;

      // Build update data
      const updateData: Record<string, unknown> = {};

      if (engagementTitle !== undefined) updateData.engagementTitle = engagementTitle;
      if (engagementObjective !== undefined) updateData.engagementObjective = engagementObjective;
      if (engagementScope !== undefined) updateData.engagementScope = engagementScope;
      if (departmentId !== undefined) updateData.departmentId = departmentId || null;
      if (auditType !== undefined) updateData.auditType = auditType;
      if (auditRating !== undefined) updateData.auditRating = auditRating;
      if (auditorId !== undefined) updateData.assignedAuditorId = auditorId || null;
      if (auditeeId !== undefined) updateData.auditeeId = auditeeId || null;
      if (startDate !== undefined) updateData.plannedStartDate = startDate ? new Date(startDate) : null;
      if (targetDate !== undefined) updateData.plannedEndDate = targetDate ? new Date(targetDate) : null;
      if (plannedHours !== undefined) updateData.plannedHours = plannedHours || 0;
      if (initialObservation !== undefined) updateData.initialObservation = initialObservation;
      if (relatedPolicies !== undefined) updateData.relatedPolicies = relatedPolicies;
      if (status !== undefined) updateData.status = status;

      const engagement = await prisma.auditEngagement.update({
        where: { id },
        data: updateData,
        include: {
          department: {
            select: { id: true, name: true }
          },
          assignedAuditor: {
            select: { id: true, firstName: true, lastName: true }
          },
          auditee: {
            select: { id: true, firstName: true, lastName: true }
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
  { resource: 'audit.planning', action: 'edit' }
);

// PATCH /api/internal-audit/engagements/[id] - Partial update an engagement (e.g., status change)
export const PATCH = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const body = await req.json();

      // Only allow specific fields to be updated via PATCH
      const updateData: Record<string, unknown> = {};

      if (body.status !== undefined) {
        updateData.status = body.status;
      }
      if (body.completionDate !== undefined) {
        updateData.completionDate = body.completionDate ? new Date(body.completionDate) : null;
      }

      // If marking as completed, set completion date if not provided
      if (body.status === 'Completed' && !body.completionDate) {
        updateData.completionDate = new Date();
      }

      const engagement = await prisma.auditEngagement.update({
        where: { id },
        data: updateData,
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
  { resource: 'audit.fieldwork', action: 'edit' }
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
