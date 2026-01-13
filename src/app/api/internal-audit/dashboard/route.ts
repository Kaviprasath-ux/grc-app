import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

// GET /api/internal-audit/dashboard - Get dashboard stats
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

      // Get risk register stats
      const [
        totalRisks,
        extremeRisks,
        highRisks,
        mediumRisks,
        lowRisks,
      ] = await Promise.all([
        prisma.internalAuditRisk.count(),
        prisma.internalAuditRisk.count({ where: { riskLevel: 'Extreme' } }),
        prisma.internalAuditRisk.count({ where: { riskLevel: 'High' } }),
        prisma.internalAuditRisk.count({ where: { riskLevel: 'Medium' } }),
        prisma.internalAuditRisk.count({ where: { riskLevel: 'Low' } }),
      ]);

      // Get audit engagement stats
      const [
        ongoingAudits,
        completedAudits,
        plannedAudits,
      ] = await Promise.all([
        prisma.auditEngagement.count({ where: { status: 'In Progress' } }),
        prisma.auditEngagement.count({ where: { status: 'Completed' } }),
        prisma.auditEngagement.count({ where: { status: 'Planned' } }),
      ]);

      // Get CAPA stats by department and severity
      const capaByDepartment = await prisma.internalAuditCAPA.findMany({
        where: capaFilter,
        include: {
          finding: {
            select: {
              severity: true,
              engagement: {
                select: {
                  department: {
                    select: { id: true, name: true }
                  }
                }
              }
            }
          }
        }
      });

      // Process CAPA data by department
      const departmentCAPAMap: Record<string, {
        name: string;
        open: { high: number; medium: number; low: number };
        closed: { high: number; medium: number; low: number };
      }> = {};

      capaByDepartment.forEach(capa => {
        const deptName = capa.finding?.engagement?.department?.name || 'Unknown';
        const severity = capa.finding?.severity || 'Medium';
        const status = capa.status;

        if (!departmentCAPAMap[deptName]) {
          departmentCAPAMap[deptName] = {
            name: deptName,
            open: { high: 0, medium: 0, low: 0 },
            closed: { high: 0, medium: 0, low: 0 }
          };
        }

        const statusKey = status === 'Closed' ? 'closed' : 'open';
        const severityKey = severity.toLowerCase() as 'high' | 'medium' | 'low';
        if (severityKey in departmentCAPAMap[deptName][statusKey]) {
          departmentCAPAMap[deptName][statusKey][severityKey]++;
        }
      });

      const capaStatusByDepartment = Object.values(departmentCAPAMap);

      // Get annual audit plan for current year
      const currentYear = new Date().getFullYear();
      const annualAuditPlan = await prisma.auditEngagement.findMany({
        where: {
          OR: [
            { startDate: { gte: new Date(`${currentYear}-01-01`), lte: new Date(`${currentYear}-12-31`) } },
            { endDate: { gte: new Date(`${currentYear}-01-01`), lte: new Date(`${currentYear}-12-31`) } }
          ]
        },
        select: {
          id: true,
          auditId: true,
          engagementTitle: true,
          startDate: true,
          endDate: true,
          status: true,
          department: { select: { name: true } }
        },
        orderBy: { startDate: 'asc' }
      });

      // Calculate duration in days for each audit
      const auditPlanWithDuration = annualAuditPlan.map(audit => {
        const start = audit.startDate ? new Date(audit.startDate) : new Date();
        const end = audit.endDate ? new Date(audit.endDate) : new Date();
        const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        return {
          ...audit,
          durationDays: Math.max(durationDays, 1),
          startMonth: start.getMonth(), // 0-11
          endMonth: end.getMonth()
        };
      });

      // Get evidence request stats (for auditee view)
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
        // Main dashboard stats
        riskStats: {
          total: totalRisks,
          extreme: extremeRisks,
          high: highRisks,
          medium: mediumRisks,
          low: lowRisks
        },
        auditStats: {
          ongoing: ongoingAudits,
          completed: completedAudits,
          planned: plannedAudits
        },
        capaStatusByDepartment,
        annualAuditPlan: auditPlanWithDuration,
        currentYear,

        // Auditee-specific stats
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
