import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getAuditHeadFilter } from '@/lib/api-auth';

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
          departmentMap[deptId].audits.push({
            id: engagement.id,
            auditId: engagement.auditId,
            engagementTitle: engagement.engagementTitle,
            actualHours: engagement.actualHours || 0,
            plannedHours: engagement.plannedHours || 0,
            status: engagement.status
          });
        }
      });

      // Convert to array and filter out empty departments
      const auditUniverse = Object.values(departmentMap).filter(dept => dept.audits.length > 0);

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
