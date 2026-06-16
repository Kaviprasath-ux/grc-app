import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getAuditHeadFilter } from '@/lib/api-auth';

function calculateWorkingHours(startDate: Date | null, endDate: Date | null): number {
  if (!startDate) return 0;
  const end = endDate || new Date();
  const start = new Date(startDate);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  let workingDays = 0;
  const currentDate = new Date(start);
  for (let i = 0; i < diffDays; i++) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) workingDays++;
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return workingDays * 8;
}

function mapEngagements(engagements: {
  id: string;
  auditId: string;
  engagementTitle: string;
  plannedHours: number;
  actualHours: number;
  status: string;
  actualStartDate: Date | null;
  actualEndDate: Date | null;
  startDate: Date | null;
  endDate: Date | null;
}[]) {
  return engagements.map(engagement => {
    const effectiveStartDate = engagement.actualStartDate || engagement.startDate;
    const effectiveEndDate = engagement.actualEndDate || engagement.endDate;
    const statusLower = engagement.status?.toLowerCase() || '';
    let calculatedActualHours = 0;
    if (statusLower === 'completed' || statusLower === 'complete' || statusLower === 'closed') {
      calculatedActualHours = (effectiveStartDate && effectiveEndDate)
        ? calculateWorkingHours(effectiveStartDate, effectiveEndDate)
        : engagement.actualHours || 0;
    } else if (['in progress', 'inprogress', 'ongoing', 'active'].includes(statusLower)) {
      calculatedActualHours = effectiveStartDate
        ? calculateWorkingHours(effectiveStartDate, null)
        : engagement.actualHours || 0;
    }
    return {
      id: engagement.id,
      auditId: engagement.auditId,
      engagementTitle: engagement.engagementTitle,
      plannedHours: engagement.plannedHours || 0,
      actualHours: calculatedActualHours,
      status: engagement.status,
      startDate: effectiveStartDate?.toISOString() || null,
      endDate: effectiveEndDate?.toISOString() || null,
    };
  });
}

// GET /api/internal-audit/audit-universe
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      const engagementSelect = {
        id: true,
        auditId: true,
        engagementTitle: true,
        plannedHours: true,
        actualHours: true,
        status: true,
        actualStartDate: true,
        actualEndDate: true,
        startDate: true,
        endDate: true,
      };

      // ── 1. DEPARTMENTS (independent) ─────────────────────────────────────
      const departments = await prisma.department.findMany({
        where: tenantFilter,
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      });

      const deptEngagements = await prisma.auditEngagement.findMany({
        where: { ...tenantFilter, ...auditHeadFilter },
        select: { ...engagementSelect, departmentId: true },
        orderBy: { auditId: 'asc' },
      });

      const deptMap: Record<string, typeof departments[0] & { audits: ReturnType<typeof mapEngagements> }> = {};
      departments.forEach(d => { deptMap[d.id] = { ...d, audits: [] }; });
      deptEngagements.forEach(e => {
        if (e.departmentId && deptMap[e.departmentId]) {
          deptMap[e.departmentId].audits.push(...mapEngagements([e]));
        }
      });
      const deptList = Object.values(deptMap).sort((a, b) => {
        if (a.audits.length > 0 && b.audits.length === 0) return -1;
        if (a.audits.length === 0 && b.audits.length > 0) return 1;
        return a.name.localeCompare(b.name);
      });

      // ── 2. PROCESSES (independent — InternalAuditProcess) ────────────────
      const processes = await prisma.internalAuditProcess.findMany({
        where: { ...tenantFilter, ...auditHeadFilter },
        select: { id: true, processCode: true, name: true, description: true },
        orderBy: { name: 'asc' },
      });

      // ── 3. IT AUDITS (independent — AuditableEntity) ─────────────────────
      const itAudits = await prisma.auditableEntity.findMany({
        where: tenantFilter,
        select: {
          id: true,
          entityCode: true,
          name: true,
          description: true,
          plannedHours: true,
          actualHours: true,
          riskRating: true,
          status: true,
          engagements: {
            select: engagementSelect,
            orderBy: { auditId: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      });

      const itAuditList = itAudits.map(e => ({
        id: e.id,
        entityCode: e.entityCode,
        name: e.name,
        description: e.description,
        plannedHours: e.plannedHours || 0,
        actualHours: e.actualHours || 0,
        riskRating: e.riskRating,
        status: e.status,
        audits: mapEngagements(e.engagements),
      }));

      return NextResponse.json({
        departments: deptList,
        processes,
        itAudits: itAuditList,
        totalDepartments: deptList.length,
        totalProcesses: processes.length,
        totalITAudits: itAuditList.length,
        totalAudits: deptEngagements.length,
      });
    } catch (error) {
      console.error('Error fetching audit universe:', error);
      return NextResponse.json({ error: 'Failed to fetch audit universe' }, { status: 500 });
    }
  },
  { resource: 'audit.planning', action: 'view' }
);
