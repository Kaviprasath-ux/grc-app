import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

// GET /api/internal-audit/risk-universe - Get risk universe data organized by department
export const GET = withAuth(
  async (req: NextRequest) => {
    try {
      // Get all departments
      const departments = await prisma.department.findMany({
        orderBy: { name: 'asc' }
      });

      // Get all risks
      const risks = await prisma.internalAuditRisk.findMany({
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
          riskLevel: string | null;
          inherentScore: number | null;
          residualScore: number | null;
        }>;
      }> = {};

      // Initialize all departments
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
            riskLevel: risk.riskLevel,
            inherentScore: risk.inherentScore,
            residualScore: risk.residualScore
          });
        }
      });

      // Convert to array and filter out empty departments
      const riskUniverse = Object.values(departmentMap).filter(dept => dept.risks.length > 0);

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
  { resource: 'audit.risks', action: 'view' }
);
