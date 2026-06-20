import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getCustomerAccountId, getAuditHeadId } from '@/lib/api-auth';

const engagementSelect = {
  id: true,
  auditId: true,
  engagementTitle: true,
  engagementObjective: true,
  plannedHours: true,
  actualHours: true,
  status: true,
  actualStartDate: true,
  actualEndDate: true,
  startDate: true,
  endDate: true,
  department: { select: { id: true, name: true } },
};

function getEffectiveEndDate(e: {
  actualEndDate: Date | null;
  endDate: Date | null;
  actualStartDate: Date | null;
  startDate: Date | null;
}) {
  return e.actualEndDate || e.endDate || null;
}

// GET /api/internal-audit/audit-universe
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);

      const tenantWhere = {
        ...(customerAccountId ? { customerAccountId } : {}),
        ...(auditHeadId ? { auditHeadId } : {}),
      };

      // Fetch categories with processes and risks (including department + description)
      const categories = await prisma.auditCategory.findMany({
        where: tenantWhere,
        select: {
          id: true,
          name: true,
          internalAuditProcesses: {
            where: tenantWhere,
            select: {
              id: true,
              processCode: true,
              name: true,
              description: true,
              department: { select: { id: true, name: true } },
            },
            orderBy: { name: 'asc' },
          },
          internalAuditRisks: {
            where: tenantWhere,
            select: {
              id: true,
              riskId: true,
              riskName: true,
              riskDescription: true,
              relatedLawRegulation: true,
              department: { select: { id: true, name: true } },
              engagementId: true,
              engagement: { select: engagementSelect },
            },
            orderBy: { riskName: 'asc' },
          },
          // Fetch engagements linked directly to this category via auditCategoryId
          engagements: {
            where: tenantWhere,
            select: engagementSelect,
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      });

      const categoryData = categories.map(cat => {
        // Collect audits: first from risk-linked engagements, then from direct auditCategoryId links
        const auditMap = new Map<string, {
          id: string;
          auditId: string;
          engagementTitle: string;
          description: string | null;
          departmentName: string | null;
          lastAuditDate: string | null;
          status: string;
          plannedHours: number;
          actualHours: number;
          startDate: string | null;
          endDate: string | null;
        }>();

        // Risk-linked engagements
        cat.internalAuditRisks.forEach(r => {
          if (r.engagement && !auditMap.has(r.engagement.id)) {
            const endDate = getEffectiveEndDate(r.engagement);
            auditMap.set(r.engagement.id, {
              id: r.engagement.id,
              auditId: r.engagement.auditId,
              engagementTitle: r.engagement.engagementTitle,
              description: r.engagement.engagementObjective || null,
              departmentName: r.engagement.department?.name || null,
              lastAuditDate: endDate?.toISOString() || null,
              status: r.engagement.status,
              plannedHours: r.engagement.plannedHours || 0,
              actualHours: r.engagement.actualHours || 0,
              startDate: (r.engagement.actualStartDate || r.engagement.startDate)?.toISOString() || null,
              endDate: endDate?.toISOString() || null,
            });
          }
        });

        // Direct auditCategoryId-linked engagements
        cat.engagements.forEach(e => {
          if (!auditMap.has(e.id)) {
            const endDate = getEffectiveEndDate(e);
            auditMap.set(e.id, {
              id: e.id,
              auditId: e.auditId,
              engagementTitle: e.engagementTitle,
              description: e.engagementObjective || null,
              departmentName: e.department?.name || null,
              lastAuditDate: endDate?.toISOString() || null,
              status: e.status,
              plannedHours: e.plannedHours || 0,
              actualHours: e.actualHours || 0,
              startDate: (e.actualStartDate || e.startDate)?.toISOString() || null,
              endDate: endDate?.toISOString() || null,
            });
          }
        });

        return {
          id: cat.id,
          name: cat.name,
          processes: cat.internalAuditProcesses.map(p => ({
            id: p.id,
            processCode: p.processCode,
            name: p.name,
            description: p.description || null,
            departmentName: p.department?.name || null,
          })),
          risks: cat.internalAuditRisks.map(r => ({
            id: r.id,
            riskId: r.riskId,
            riskName: r.riskName,
            description: r.riskDescription || null,
            departmentName: r.department?.name || null,
            regulatoryRequirement: r.relatedLawRegulation || null,
          })),
          audits: Array.from(auditMap.values()),
        };
      });

      const totalProcesses = categoryData.reduce((s, c) => s + c.processes.length, 0);
      const totalRisks = categoryData.reduce((s, c) => s + c.risks.length, 0);
      const totalAudits = new Set(
        categoryData.flatMap(c => c.audits.map(a => a.id))
      ).size;

      return NextResponse.json({
        categories: categoryData,
        totalCategories: categoryData.length,
        totalProcesses,
        totalRisks,
        totalAudits,
      });
    } catch (error) {
      console.error('Error fetching audit universe:', error);
      return NextResponse.json({ error: 'Failed to fetch audit universe' }, { status: 500 });
    }
  },
  { resource: 'audit.auditables', action: 'view' }
);
