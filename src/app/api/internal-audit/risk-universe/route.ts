import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter } from '@/lib/api-auth';

// Normalize risk level to consistent casing
function normalizeRiskLevel(level: string | null): string {
  if (!level) return 'Low';

  const lowerLevel = level.toLowerCase();

  if (lowerLevel === 'extreme' || lowerLevel === 'critical') {
    return 'Extreme';
  }
  if (lowerLevel === 'high') {
    return 'High';
  }
  if (lowerLevel === 'medium' || lowerLevel === 'moderate') {
    return 'Medium';
  }
  return 'Low';
}

// GET /api/internal-audit/risk-universe - Get risk universe data organized by department
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      // Get departments for this tenant
      const departments = await prisma.department.findMany({
        where: tenantFilter,
        orderBy: { name: 'asc' }
      });

      // Get all risks for this tenant
      const risks = await prisma.internalAuditRisk.findMany({
        where: tenantFilter,
        include: {
          department: {
            select: { id: true, name: true }
          }
        },
        orderBy: { riskId: 'asc' }
      });

      // Organize risks by department
      const departmentMap: Record<string, {
        id: string;
        name: string;
        risks: Array<{
          id: string;
          riskId: string;
          riskName: string;
          riskLevel: string;
        }>;
      }> = {};

      // Initialize departments that have risks
      departments.forEach(dept => {
        departmentMap[dept.id] = {
          id: dept.id,
          name: dept.name,
          risks: []
        };
      });

      // Add risks to their departments
      risks.forEach(risk => {
        const deptId = risk.departmentId;
        if (deptId && departmentMap[deptId]) {
          departmentMap[deptId].risks.push({
            id: risk.id,
            riskId: risk.riskId,
            riskName: risk.riskName,
            riskLevel: normalizeRiskLevel(risk.riskLevel)
          });
        }
      });

      // Convert to array - show ALL departments from settings (even without risks)
      const riskUniverse = Object.values(departmentMap).sort((a, b) => a.name.localeCompare(b.name));

      return NextResponse.json({
        departments: riskUniverse,
        totalDepartments: riskUniverse.length,
        totalRisks: risks.length
      });
    } catch (error) {
      console.error('Error fetching risk universe:', error);
      return NextResponse.json(
        { error: 'Failed to fetch risk universe' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.risk-universe', action: 'view' }
);
