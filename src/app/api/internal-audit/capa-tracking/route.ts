import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

// GET /api/internal-audit/capa-tracking - Get all findings for CAPA tracking
export const GET = withAuth(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const departmentId = searchParams.get('departmentId');
      const status = searchParams.get('status');
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const skip = (page - 1) * limit;

      // Build where clause
      const where: Record<string, unknown> = {};
      if (departmentId) {
        where.departmentId = departmentId;
      }
      if (status) {
        where.status = status;
      }

      // Get total count
      const total = await prisma.internalAuditFinding.count({ where });

      // Get findings with relations
      const findings = await prisma.internalAuditFinding.findMany({
        where,
        include: {
          engagement: {
            select: {
              id: true,
              engagementTitle: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      // Transform findings for the response
      const transformedFindings = findings.map((finding) => ({
        id: finding.id,
        findingId: finding.findingId,
        finding: finding.finding,
        description: finding.description,
        severity: finding.severity,
        auditPlan: finding.engagement?.engagementTitle || '-',
        engagementId: finding.engagementId,
        departmentId: finding.departmentId,
        departmentName: finding.department?.name || '-',
        responsiblePerson: finding.responsiblePerson || '-',
        targetDate: finding.targetDate,
        status: finding.status,
        identifiedDate: finding.identifiedDate,
        closedDate: finding.closedDate,
        createdAt: finding.createdAt,
        // Additional fields for Edit CAPA
        criteria: finding.criteria,
        condition: finding.condition,
        cause: finding.cause,
        effect: finding.effect,
        recommendation: finding.recommendation,
        auditeeComment: finding.description, // Map description to auditeeComment for now
      }));

      return NextResponse.json({
        findings: transformedFindings,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching CAPA tracking data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch CAPA tracking data' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);
