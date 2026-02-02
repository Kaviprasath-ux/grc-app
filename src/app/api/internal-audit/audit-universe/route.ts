import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getAuditHeadFilter } from '@/lib/api-auth';

// Helper function to calculate working hours between two dates
// Assumes 8 working hours per day
function calculateWorkingHours(startDate: Date | null, endDate: Date | null): number {
  if (!startDate) return 0;

  const end = endDate || new Date(); // Use current date if not completed
  const start = new Date(startDate);

  // Calculate the difference in milliseconds
  const diffMs = end.getTime() - start.getTime();

  // Convert to days
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Calculate working days (exclude weekends - rough estimate)
  // For more accuracy, we'd need to exclude holidays too
  let workingDays = 0;
  const currentDate = new Date(start);

  for (let i = 0; i < diffDays; i++) {
    const dayOfWeek = currentDate.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Assume 8 working hours per day
  return workingDays * 8;
}

// GET /api/internal-audit/audit-universe - Get audit universe data organized by department
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      // Multi-tenant + AuditHead filtering
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      // Get departments for this tenant
      const departments = await prisma.department.findMany({
        where: tenantFilter,
        orderBy: { name: 'asc' }
      });

      // Get audit engagements with tenant and audit head filtering
      const engagements = await prisma.auditEngagement.findMany({
        where: {
          ...tenantFilter,
          ...auditHeadFilter,
        },
        include: {
          department: {
            select: { id: true, name: true }
          }
        },
        orderBy: { auditId: 'asc' }
      });

      // Organize engagements by department
      const departmentMap: Record<string, {
        id: string;
        name: string;
        audits: Array<{
          id: string;
          auditId: string;
          engagementTitle: string;
          actualHours: number;
          plannedHours: number;
          status: string;
          startDate: string | null;
          endDate: string | null;
        }>;
      }> = {};

      // Initialize all departments
      departments.forEach(dept => {
        departmentMap[dept.id] = {
          id: dept.id,
          name: dept.name,
          audits: []
        };
      });

      // Add audits to their departments
      engagements.forEach(engagement => {
        const deptId = engagement.departmentId;
        if (deptId && departmentMap[deptId]) {
          // Calculate actual hours based on status and dates
          let calculatedActualHours = 0;

          // Use actualStartDate/actualEndDate if available, otherwise use startDate/endDate
          const effectiveStartDate = engagement.actualStartDate || engagement.startDate;
          const effectiveEndDate = engagement.actualEndDate || engagement.endDate;

          // Status-based logic for actual hours calculation
          const statusLower = engagement.status?.toLowerCase() || '';

          if (statusLower === 'completed' || statusLower === 'complete' || statusLower === 'closed') {
            // For completed audits: calculate hours from start to end date
            if (effectiveStartDate && effectiveEndDate) {
              calculatedActualHours = calculateWorkingHours(effectiveStartDate, effectiveEndDate);
            } else {
              // Fallback to stored actualHours if dates not available
              calculatedActualHours = engagement.actualHours || 0;
            }
          } else if (statusLower === 'in progress' || statusLower === 'inprogress' || statusLower === 'ongoing' || statusLower === 'active') {
            // For in-progress audits: calculate hours from start to now
            if (effectiveStartDate) {
              calculatedActualHours = calculateWorkingHours(effectiveStartDate, null);
            } else {
              calculatedActualHours = engagement.actualHours || 0;
            }
          } else {
            // For planned/draft audits: no actual hours yet (use 0)
            calculatedActualHours = 0;
          }

          departmentMap[deptId].audits.push({
            id: engagement.id,
            auditId: engagement.auditId,
            engagementTitle: engagement.engagementTitle,
            // Planned Hours: from plannedHours field (set when audit is created)
            plannedHours: engagement.plannedHours || 0,
            // Actual Hours: calculated from duration between start and completion
            actualHours: calculatedActualHours,
            status: engagement.status,
            startDate: effectiveStartDate?.toISOString() || null,
            endDate: effectiveEndDate?.toISOString() || null
          });
        }
      });

      // Convert to array - include ALL departments (even those without audits)
      const auditUniverse = Object.values(departmentMap);

      // Sort departments: those with audits first, then alphabetically
      auditUniverse.sort((a, b) => {
        // First, sort by whether they have audits (departments with audits come first)
        if (a.audits.length > 0 && b.audits.length === 0) return -1;
        if (a.audits.length === 0 && b.audits.length > 0) return 1;
        // Then sort alphabetically by name
        return a.name.localeCompare(b.name);
      });

      return NextResponse.json({
        departments: auditUniverse,
        totalDepartments: auditUniverse.length,
        totalAudits: engagements.length
      });
    } catch (error) {
      console.error('Error fetching audit universe:', error);
      return NextResponse.json(
        { error: 'Failed to fetch audit universe' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.planning', action: 'view' }
);
