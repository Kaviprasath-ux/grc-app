import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getAuditHeadFilter } from '@/lib/api-auth';

// GET /api/internal-audit/capa-tracking - Get all findings for CAPA tracking
export const GET = withAuth(
  async (req: NextRequest, context: unknown, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const departmentId = searchParams.get('departmentId');
      const status = searchParams.get('status');
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const skip = (page - 1) * limit;

      // Get tenant filter
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      // Check if user is auditee only (has Auditee role but not AuditHead/AuditManager/Auditor)
      const userRoles = session.roles || [];
      const isAuditTeam = userRoles.some((role: string) =>
        ['AuditHead', 'AuditManager', 'Auditor'].includes(role)
      );
      const isAuditee = userRoles.includes('Auditee');
      const isAuditeeOnly = isAuditee && !isAuditTeam;

      // Build where clause with tenant filter
      const where: Record<string, unknown> = { ...tenantFilter };

      // For auditee-only users, filter to show only their assigned findings
      if (isAuditeeOnly && session.id) {
        where.responsiblePersonId = session.id;
      } else if (isAuditTeam) {
        // For AuditHead/AuditManager/Auditor, filter through engagement
        where.engagement = auditHeadFilter;
      }

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
          attachments: {
            orderBy: { uploadedAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      // Transform findings for the response
      const transformedFindings = findings.map((finding) => {
        // Determine if user can see AI review results
        // Audit team (AuditHead, AuditManager, Auditor) can always see AI review
        // Auditee can only see AI review after Audit Head has approved it
        const canSeeAiReview = isAuditTeam || finding.aiReviewApproved;

        return {
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
          // Attachments
          attachments: finding.attachments || [],
          // AI Review fields (role-based visibility)
          aiReviewStatus: canSeeAiReview ? finding.aiReviewStatus : null,
          aiReviewDescription: canSeeAiReview ? finding.aiReviewDescription : null,
          aiReviewedAt: canSeeAiReview ? finding.aiReviewedAt : null,
          aiReviewApproved: finding.aiReviewApproved,
          aiApprovedAt: finding.aiReviewApproved ? finding.aiApprovedAt : null,
          aiApprovedBy: finding.aiReviewApproved ? finding.aiApprovedBy : null,
        };
      });

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
