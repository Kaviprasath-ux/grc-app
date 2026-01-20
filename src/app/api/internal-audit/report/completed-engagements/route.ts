import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

// GET /api/internal-audit/report/completed-engagements - Get all completed engagements for reports
export const GET = withAuth(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const skip = (page - 1) * limit;

      // Get total count of completed engagements (case-insensitive check)
      const total = await prisma.auditEngagement.count({
        where: {
          OR: [
            { status: 'Completed' },
            { status: 'completed' },
            { status: 'COMPLETED' },
          ],
        },
      });

      // Get completed engagements with relations
      const engagements = await prisma.auditEngagement.findMany({
        where: {
          OR: [
            { status: 'Completed' },
            { status: 'completed' },
            { status: 'COMPLETED' },
          ],
        },
        include: {
          department: {
            select: { id: true, name: true },
          },
          assignedAuditor: {
            select: { id: true, firstName: true, lastName: true },
          },
          report: {
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      // Transform engagements for the response
      const transformedEngagements = engagements.map((engagement) => ({
        id: engagement.id,
        auditId: engagement.auditId,
        engagementTitle: engagement.engagementTitle,
        departmentName: engagement.department?.name || '-',
        auditType: engagement.auditType || 'Internal',
        assignedAuditorName: engagement.assignedAuditor
          ? `${engagement.assignedAuditor.firstName} ${engagement.assignedAuditor.lastName}`
          : '-',
        status: engagement.status,
        hasReport: !!engagement.report,
        reportId: engagement.report?.id || null,
      }));

      return NextResponse.json({
        engagements: transformedEngagements,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching completed engagements:', error);
      return NextResponse.json(
        { error: 'Failed to fetch completed engagements' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);
