import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

// GET /api/internal-audit/dashboard - Get dashboard stats for auditee/auditor
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const isAuditee = session.roles.includes('Auditee') &&
                        !session.roles.includes('AuditHead') &&
                        !session.roles.includes('Auditor');

      // Base filters for auditee
      const auditeeFilter = isAuditee ? { auditeeId: session.id } : {};
      const capaFilter = isAuditee ? {
        finding: {
          OR: [
            { responsiblePersonId: session.id },
            { department: { id: session.departmentId || '' } }
          ]
        }
      } : {};

      // Get evidence request stats
      const [
        pendingEvidenceRequests,
        inProgressEvidenceRequests,
        submittedEvidenceRequests,
        reviewedEvidenceRequests,
        overdueEvidenceRequests,
      ] = await Promise.all([
        prisma.fieldworkEvidenceRequest.count({
          where: { ...auditeeFilter, status: 'Pending' }
        }),
        prisma.fieldworkEvidenceRequest.count({
          where: { ...auditeeFilter, status: 'In Progress' }
        }),
        prisma.fieldworkEvidenceRequest.count({
          where: { ...auditeeFilter, status: 'Submitted' }
        }),
        prisma.fieldworkEvidenceRequest.count({
          where: { ...auditeeFilter, status: 'Reviewed' }
        }),
        prisma.fieldworkEvidenceRequest.count({
          where: {
            ...auditeeFilter,
            status: { in: ['Pending', 'In Progress'] },
            dueDate: { lt: new Date() }
          }
        }),
      ]);

      // Get CAPA stats
      const [
        openCAPAs,
        inProgressCAPAs,
        closedCAPAs,
        overdueCAPAs,
      ] = await Promise.all([
        prisma.internalAuditCAPA.count({
          where: { ...capaFilter, status: 'Open' }
        }),
        prisma.internalAuditCAPA.count({
          where: { ...capaFilter, status: 'In Progress' }
        }),
        prisma.internalAuditCAPA.count({
          where: { ...capaFilter, status: 'Closed' }
        }),
        prisma.internalAuditCAPA.count({
          where: {
            ...capaFilter,
            status: { in: ['Open', 'In Progress'] },
            targetDate: { lt: new Date() }
          }
        }),
      ]);

      // Get recent evidence requests
      const recentEvidenceRequests = await prisma.fieldworkEvidenceRequest.findMany({
        where: auditeeFilter,
        include: {
          engagement: {
            select: {
              auditId: true,
              engagementTitle: true,
              department: { select: { name: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      // Get recent CAPAs
      const recentCAPAs = await prisma.internalAuditCAPA.findMany({
        where: capaFilter,
        include: {
          finding: {
            select: {
              findingId: true,
              finding: true,
              engagement: {
                select: { auditId: true, engagementTitle: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      // Get upcoming due dates
      const upcomingDueDates = await prisma.fieldworkEvidenceRequest.findMany({
        where: {
          ...auditeeFilter,
          status: { in: ['Pending', 'In Progress'] },
          dueDate: { gte: new Date() }
        },
        include: {
          engagement: {
            select: { auditId: true, engagementTitle: true }
          }
        },
        orderBy: { dueDate: 'asc' },
        take: 5
      });

      return NextResponse.json({
        stats: {
          evidenceRequests: {
            pending: pendingEvidenceRequests,
            inProgress: inProgressEvidenceRequests,
            submitted: submittedEvidenceRequests,
            reviewed: reviewedEvidenceRequests,
            overdue: overdueEvidenceRequests,
            total: pendingEvidenceRequests + inProgressEvidenceRequests + submittedEvidenceRequests + reviewedEvidenceRequests
          },
          capa: {
            open: openCAPAs,
            inProgress: inProgressCAPAs,
            closed: closedCAPAs,
            overdue: overdueCAPAs,
            total: openCAPAs + inProgressCAPAs + closedCAPAs
          }
        },
        recentEvidenceRequests,
        recentCAPAs,
        upcomingDueDates
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch dashboard data' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);
