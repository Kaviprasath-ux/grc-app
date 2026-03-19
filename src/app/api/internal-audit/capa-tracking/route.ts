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
      const engagementStatus = searchParams.get('engagementStatus') || 'All'; // Default to All - show findings from all engagement statuses
      const search = searchParams.get('search');
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const skip = (page - 1) * limit;

      // Get tenant filter
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      // Check if user is auditee only (has Auditee role but not AuditHead/Auditor/Auditor)
      const userRoles = session.roles || [];
      const auditTeamRoles = ['AuditHead', 'Auditor', 'Auditor'];
      const isAuditTeam = userRoles.some((role: string) =>
        auditTeamRoles.some(r => r.toLowerCase() === role.toLowerCase())
      );
      const isAuditee = userRoles.some((role: string) => role.toLowerCase() === 'auditee');
      const isAuditeeOnly = isAuditee && !isAuditTeam;

      // Debug logging
      console.log('[CAPA-GET] User roles:', userRoles, 'isAuditTeam:', isAuditTeam, 'isAuditee:', isAuditee);

      // Build where clause with tenant filter
      const where: Record<string, unknown> = { ...tenantFilter };

      // IMPORTANT: Filter findings by engagement status (default: Completed)
      // This ensures findings appear in CAPA tracking only when engagement reaches the specified status
      const engagementFilter: Record<string, unknown> = engagementStatus === "All"
        ? {}
        : { status: engagementStatus };

      // For auditee-only users, filter to show only their assigned findings
      if (isAuditeeOnly && session.id) {
        where.responsiblePersonId = session.id;
        // Apply engagement status filter for auditees too
        if (Object.keys(engagementFilter).length > 0) {
          where.engagement = engagementFilter;
        }
      } else if (isAuditTeam) {
        // For AuditHead/Auditor/Auditor, filter through engagement
        // Merge audit head filter with engagement status filter
        where.engagement = {
          ...auditHeadFilter,
          ...engagementFilter,
        };
      } else {
        // For other users, filter by engagement status
        if (Object.keys(engagementFilter).length > 0) {
          where.engagement = engagementFilter;
        }
      }

      if (departmentId) {
        where.departmentId = departmentId;
      }
      if (status) {
        where.status = status;
      }
      if (search) {
        where.OR = [
          { findingId: { contains: search, mode: 'insensitive' } },
          { finding: { contains: search, mode: 'insensitive' } },
          { responsiblePerson: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Get total count
      const total = await prisma.internalAuditFinding.count({ where });

      // Get findings with relations including attachments and AI review fields
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
          // Attachments from database
          attachments: finding.attachments.map(att => ({
            id: att.id,
            fileName: att.fileName,
            fileType: att.fileType,
            fileSize: att.fileSize,
            filePath: att.filePath,
            uploadedBy: null,
            uploadedAt: att.uploadedAt.toISOString(),
          })),
          // AI Review fields from database
          aiReviewStatus: finding.aiReviewStatus,
          aiReviewDescription: finding.aiReviewDescription,
          aiReviewedAt: finding.aiReviewedAt,
          aiReviewApproved: finding.aiReviewApproved,
          aiApprovedAt: finding.aiApprovedAt,
          aiApprovedBy: finding.aiApprovedBy,
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
