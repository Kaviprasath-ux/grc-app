import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getAuditHeadFilter, getAuditHeadRiskFilter } from '@/lib/api-auth';

// GET /api/internal-audit/dashboard/drill-down - Get detailed drill-down data
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const type = searchParams.get('type'); // risks, audits, capa
      const filter = searchParams.get('filter'); // extreme, high, medium, low, ongoing, completed, planned, department name
      const department = searchParams.get('department'); // for CAPA drill-down
      const status = searchParams.get('status'); // open, closed for CAPA

      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);
      const riskFilter = getAuditHeadRiskFilter(session);

      const engagementFilter = { ...tenantFilter, ...auditHeadFilter };
      const riskQueryFilter = { ...tenantFilter, ...riskFilter };

      switch (type) {
        case 'risks': {
          // Build risk level filter based on filter parameter
          let riskLevelFilter = {};
          if (filter && filter !== 'all') {
            const filterLower = filter.toLowerCase();
            if (filterLower === 'extreme') {
              riskLevelFilter = {
                OR: [
                  { riskLevel: 'Extreme' },
                  { riskLevel: 'extreme' },
                  { riskLevel: 'EXTREME' },
                  { riskLevel: 'Critical' },
                  { riskLevel: 'critical' }
                ]
              };
            } else if (filterLower === 'high') {
              riskLevelFilter = {
                OR: [
                  { riskLevel: 'High' },
                  { riskLevel: 'high' },
                  { riskLevel: 'HIGH' }
                ]
              };
            } else if (filterLower === 'medium') {
              riskLevelFilter = {
                OR: [
                  { riskLevel: 'Medium' },
                  { riskLevel: 'medium' },
                  { riskLevel: 'MEDIUM' },
                  { riskLevel: 'Moderate' }
                ]
              };
            } else if (filterLower === 'low') {
              riskLevelFilter = {
                OR: [
                  { riskLevel: 'Low' },
                  { riskLevel: 'low' },
                  { riskLevel: 'LOW' }
                ]
              };
            }
          }

          const risks = await prisma.internalAuditRisk.findMany({
            where: {
              ...riskQueryFilter,
              ...riskLevelFilter
            },
            include: {
              department: { select: { name: true } },
              category: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
          });

          return NextResponse.json({
            type: 'risks',
            filter,
            data: risks.map(risk => ({
              id: risk.id,
              riskId: risk.riskId,
              riskDescription: risk.riskDescription,
              riskLevel: risk.riskLevel,
              status: risk.status,
              department: risk.department?.name || 'N/A',
              category: risk.category?.name || 'N/A',
              inherentScore: risk.inherentScore,
              residualScore: risk.residualScore,
              createdAt: risk.createdAt
            })),
            total: risks.length
          });
        }

        case 'audits': {
          // Build status filter based on filter parameter
          let statusFilter = {};
          if (filter && filter !== 'all') {
            const filterLower = filter.toLowerCase();
            if (filterLower === 'ongoing' || filterLower === 'in progress') {
              statusFilter = {
                OR: [
                  { status: 'In Progress' },
                  { status: 'InProgress' },
                  { status: 'Ongoing' },
                  { status: 'Active' }
                ]
              };
            } else if (filterLower === 'completed') {
              statusFilter = {
                OR: [
                  { status: 'Completed' },
                  { status: 'Complete' },
                  { status: 'Done' },
                  { status: 'Closed' }
                ]
              };
            } else if (filterLower === 'planned') {
              statusFilter = {
                OR: [
                  { status: 'Planned' },
                  { status: 'Planning' },
                  { status: 'Draft' },
                  { status: 'Pending' }
                ]
              };
            }
          }

          const audits = await prisma.auditEngagement.findMany({
            where: {
              ...engagementFilter,
              ...statusFilter
            },
            include: {
              department: { select: { name: true } },
              assignedAuditor: { select: { fullName: true, firstName: true, lastName: true } },
              auditTypeRef: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
          });

          return NextResponse.json({
            type: 'audits',
            filter,
            data: audits.map(audit => ({
              id: audit.id,
              auditId: audit.auditId,
              engagementTitle: audit.engagementTitle,
              status: audit.status,
              department: audit.department?.name || 'N/A',
              auditType: audit.auditTypeRef?.name || audit.auditType || 'N/A',
              auditor: audit.assignedAuditor?.fullName ||
                `${audit.assignedAuditor?.firstName || ''} ${audit.assignedAuditor?.lastName || ''}`.trim() ||
                'Unassigned',
              startDate: audit.startDate,
              endDate: audit.endDate,
              year: audit.year
            })),
            total: audits.length
          });
        }

        case 'capa': {
          // Build CAPA filter based on department and status
          let capaFilter: Record<string, unknown> = { ...tenantFilter, ...riskFilter };

          if (department && department !== 'all') {
            capaFilter = {
              ...capaFilter,
              finding: {
                engagement: {
                  department: {
                    name: department
                  }
                }
              }
            };
          }

          if (status && status !== 'all') {
            if (status.toLowerCase() === 'open') {
              capaFilter.status = { in: ['Open', 'In Progress'] };
            } else if (status.toLowerCase() === 'closed') {
              capaFilter.status = 'Closed';
            }
          }

          const capas = await prisma.internalAuditCAPA.findMany({
            where: capaFilter,
            include: {
              finding: {
                select: {
                  findingId: true,
                  finding: true,
                  severity: true,
                  engagement: {
                    select: {
                      auditId: true,
                      engagementTitle: true,
                      department: { select: { name: true } }
                    }
                  }
                }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
          });

          return NextResponse.json({
            type: 'capa',
            filter: { department, status },
            data: capas.map(capa => ({
              id: capa.id,
              capaId: capa.capaId,
              title: capa.title,
              status: capa.status,
              targetDate: capa.targetDate,
              severity: capa.finding?.severity || 'N/A',
              findingId: capa.finding?.findingId || 'N/A',
              finding: capa.finding?.finding || 'N/A',
              auditId: capa.finding?.engagement?.auditId || 'N/A',
              engagementTitle: capa.finding?.engagement?.engagementTitle || 'N/A',
              department: capa.finding?.engagement?.department?.name || 'N/A',
              responsiblePerson: capa.responsiblePerson || 'Unassigned'
            })),
            total: capas.length
          });
        }

        case 'audit-plan': {
          // Get audit plan details for a specific audit
          const auditId = searchParams.get('auditId');

          if (auditId) {
            const engagement = await prisma.auditEngagement.findFirst({
              where: {
                ...engagementFilter,
                OR: [
                  { id: auditId },
                  { auditId: auditId }
                ]
              },
              include: {
                department: { select: { name: true } },
                assignedAuditor: { select: { fullName: true, firstName: true, lastName: true, email: true } },
                auditTypeRef: { select: { name: true } },
                findings: {
                  select: {
                    id: true,
                    findingId: true,
                    finding: true,
                    severity: true,
                    status: true
                  }
                },
                evidenceRequests: {
                  select: {
                    id: true,
                    title: true,
                    status: true,
                    dueDate: true
                  }
                }
              }
            });

            return NextResponse.json({
              type: 'audit-plan',
              data: engagement ? {
                id: engagement.id,
                auditId: engagement.auditId,
                engagementTitle: engagement.engagementTitle,
                status: engagement.status,
                department: engagement.department?.name || 'N/A',
                auditType: engagement.auditTypeRef?.name || engagement.auditType || 'N/A',
                auditor: {
                  name: engagement.assignedAuditor?.fullName ||
                    `${engagement.assignedAuditor?.firstName || ''} ${engagement.assignedAuditor?.lastName || ''}`.trim() ||
                    'Unassigned',
                  email: engagement.assignedAuditor?.email
                },
                startDate: engagement.startDate,
                endDate: engagement.endDate,
                plannedStartDate: engagement.plannedStartDate,
                plannedEndDate: engagement.plannedEndDate,
                objectives: engagement.engagementObjective,
                scope: engagement.engagementScope,
                findings: engagement.findings,
                evidenceRequests: engagement.evidenceRequests,
                findingsCount: engagement.findings.length,
                evidenceRequestsCount: engagement.evidenceRequests.length
              } : null
            });
          }

          return NextResponse.json({ type: 'audit-plan', data: null });
        }

        default:
          return NextResponse.json(
            { error: 'Invalid drill-down type' },
            { status: 400 }
          );
      }
    } catch (error) {
      console.error('Error fetching drill-down data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch drill-down data' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.dashboard', action: 'view' }
);
