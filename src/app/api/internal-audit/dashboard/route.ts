import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter } from '@/lib/api-auth';

// GET /api/internal-audit/dashboard - Get dashboard stats
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const isAuditee = session.roles.includes('Auditee') &&
                        !session.roles.includes('AuditHead') &&
                        !session.roles.includes('AuditManager') &&
                        !session.roles.includes('Auditor');

      // Multi-tenant: Use consistent tenant filter helper
      const tenantFilter = getTenantFilter(session);

      // Base filters for auditee (combined with tenant filter)
      const auditeeFilter = isAuditee
        ? { ...tenantFilter, auditeeId: session.id }
        : tenantFilter;
      const capaFilter = isAuditee ? {
        ...tenantFilter,
        finding: {
          OR: [
            { responsiblePersonId: session.id },
            { department: { id: session.departmentId || '' } }
          ]
        }
      } : tenantFilter;

      // Get risk register stats (with tenant filter)
      // Handle different riskLevel case variations
      const [
        totalRisks,
        extremeRisks,
        highRisks,
        mediumRisks,
        lowRisks,
      ] = await Promise.all([
        prisma.internalAuditRisk.count({ where: tenantFilter }),
        prisma.internalAuditRisk.count({
          where: {
            ...tenantFilter,
            OR: [
              { riskLevel: 'Extreme' },
              { riskLevel: 'extreme' },
              { riskLevel: 'EXTREME' },
              { riskLevel: 'Critical' },
              { riskLevel: 'critical' }
            ]
          }
        }),
        prisma.internalAuditRisk.count({
          where: {
            ...tenantFilter,
            OR: [
              { riskLevel: 'High' },
              { riskLevel: 'high' },
              { riskLevel: 'HIGH' }
            ]
          }
        }),
        prisma.internalAuditRisk.count({
          where: {
            ...tenantFilter,
            OR: [
              { riskLevel: 'Medium' },
              { riskLevel: 'medium' },
              { riskLevel: 'MEDIUM' },
              { riskLevel: 'Moderate' }
            ]
          }
        }),
        prisma.internalAuditRisk.count({
          where: {
            ...tenantFilter,
            OR: [
              { riskLevel: 'Low' },
              { riskLevel: 'low' },
              { riskLevel: 'LOW' }
            ]
          }
        }),
      ]);

      // Get audit engagement stats (with tenant filter)
      // Count by common status variations to handle different data formats
      const [
        ongoingAudits,
        completedAudits,
        plannedAudits,
        totalAudits,
      ] = await Promise.all([
        prisma.auditEngagement.count({
          where: {
            ...tenantFilter,
            OR: [
              { status: 'In Progress' },
              { status: 'InProgress' },
              { status: 'Ongoing' },
              { status: 'Active' }
            ]
          }
        }),
        prisma.auditEngagement.count({
          where: {
            ...tenantFilter,
            OR: [
              { status: 'Completed' },
              { status: 'Complete' },
              { status: 'Done' },
              { status: 'Closed' }
            ]
          }
        }),
        prisma.auditEngagement.count({
          where: {
            ...tenantFilter,
            OR: [
              { status: 'Planned' },
              { status: 'Planning' },
              { status: 'Draft' },
              { status: 'Pending' }
            ]
          }
        }),
        prisma.auditEngagement.count({ where: tenantFilter }),
      ]);

      // If status-based counts are 0 but total > 0, use total for "ongoing"
      const finalOngoing = (ongoingAudits === 0 && completedAudits === 0 && plannedAudits === 0 && totalAudits > 0)
        ? totalAudits
        : ongoingAudits;

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

      // Get annual audit plan - determine the best year to show
      const currentYear = new Date().getFullYear();

      // First, check if there's data in the current year
      let targetYear = currentYear;
      const currentYearCount = await prisma.auditEngagement.count({
        where: {
          ...tenantFilter,
          OR: [
            { startDate: { gte: new Date(`${currentYear}-01-01`), lte: new Date(`${currentYear}-12-31`) } },
            { endDate: { gte: new Date(`${currentYear}-01-01`), lte: new Date(`${currentYear}-12-31`) } },
            { year: currentYear }
          ]
        }
      });

      // If no data in current year, find the most recent year with data
      if (currentYearCount === 0) {
        // First try to find by year field (more reliable when startDate is null)
        const mostRecentByYear = await prisma.auditEngagement.findFirst({
          where: tenantFilter,
          orderBy: { year: 'desc' },
          select: { startDate: true, year: true }
        });

        // Also check by startDate in case year field is not set
        const mostRecentByDate = await prisma.auditEngagement.findFirst({
          where: { ...tenantFilter, startDate: { not: null } },
          orderBy: { startDate: 'desc' },
          select: { startDate: true, year: true }
        });

        // Use the most recent year from either source
        const yearFromYearField = mostRecentByYear?.year || 0;
        const yearFromDateField = mostRecentByDate?.startDate
          ? new Date(mostRecentByDate.startDate).getFullYear()
          : 0;

        targetYear = Math.max(yearFromYearField, yearFromDateField) || currentYear;
      }

      const annualAuditPlan = await prisma.auditEngagement.findMany({
        where: {
          ...tenantFilter,
          OR: [
            { startDate: { gte: new Date(`${targetYear}-01-01`), lte: new Date(`${targetYear}-12-31`) } },
            { endDate: { gte: new Date(`${targetYear}-01-01`), lte: new Date(`${targetYear}-12-31`) } },
            { year: targetYear }
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
        // Use actual dates if available, otherwise use Q1 of target year as default
        const defaultStart = new Date(`${targetYear}-01-01`);
        const defaultEnd = new Date(`${targetYear}-03-31`);

        const start = audit.startDate ? new Date(audit.startDate) : defaultStart;
        const end = audit.endDate ? new Date(audit.endDate) : defaultEnd;
        const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        return {
          ...audit,
          durationDays: Math.max(durationDays, 30), // Minimum 30 days for visibility
          startMonth: start.getMonth(), // 0-11
          endMonth: end.getMonth()
        };
      });

      // Get auditor schedule for target year (with tenant filter)
      const engagementsWithAuditors = await prisma.auditEngagement.findMany({
        where: {
          ...tenantFilter,
          OR: [
            { year: targetYear },
            { startDate: { gte: new Date(`${targetYear}-01-01`), lte: new Date(`${targetYear}-12-31`) } },
            { endDate: { gte: new Date(`${targetYear}-01-01`), lte: new Date(`${targetYear}-12-31`) } }
          ]
        },
        include: {
          assignedAuditor: {
            select: { id: true, firstName: true, lastName: true, fullName: true }
          },
        },
      });

      // Group by auditor for schedule
      const auditorMap = new Map<string, {
        id: string;
        name: string;
        assignments: Array<{
          auditId: string;
          engagementTitle: string;
          startMonth: number;
          endMonth: number;
          durationDays: number;
        }>;
      }>();

      engagementsWithAuditors.forEach((engagement) => {
        if (!engagement.assignedAuditor) return;

        const auditorId = engagement.assignedAuditor.id;
        const auditorName = engagement.assignedAuditor.fullName ||
          `${engagement.assignedAuditor.firstName || ''} ${engagement.assignedAuditor.lastName || ''}`.trim() ||
          'Unknown';

        if (!auditorMap.has(auditorId)) {
          auditorMap.set(auditorId, {
            id: auditorId,
            name: auditorName,
            assignments: [],
          });
        }

        const auditor = auditorMap.get(auditorId)!;

        // Use actual dates if available, otherwise use Q1 of target year as default
        const defaultStart = new Date(`${targetYear}-01-01`);
        const defaultEnd = new Date(`${targetYear}-03-31`);

        const startDate = engagement.plannedStartDate || engagement.startDate || defaultStart;
        const endDate = engagement.plannedEndDate || engagement.endDate || defaultEnd;

        const start = new Date(startDate);
        const end = new Date(endDate);
        const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        auditor.assignments.push({
          auditId: engagement.auditId,
          engagementTitle: engagement.engagementTitle,
          startMonth: start.getMonth(),
          endMonth: end.getMonth(),
          durationDays: Math.max(durationDays, 30),
        });
      });

      const auditorSchedule = Array.from(auditorMap.values());

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
          ongoing: finalOngoing,
          completed: completedAudits,
          planned: plannedAudits,
          total: totalAudits
        },
        capaStatusByDepartment,
        annualAuditPlan: auditPlanWithDuration,
        auditorSchedule,
        currentYear: targetYear,

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
  { resource: 'audit.dashboard', action: 'view' }
);
