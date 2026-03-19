import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getDataScopeFilter, getTenantFilter, getAuditHeadFilter } from '@/lib/api-auth';

// GET /api/internal-audit/fieldwork - Get fieldwork evidence requests
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status');
      const search = searchParams.get('search');

      // Build where clause based on user's scope
      const scopeFilter = getDataScopeFilter(session, 'audit.fieldwork', 'view');
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      // For Auditee role, filter by auditeeId (their user ID)
      const isAuditee = session.roles.includes('Auditee') &&
                        !session.roles.includes('AuditHead') &&
                        !session.roles.includes('Auditor') &&
                        !session.roles.includes('Auditor');

      // Check if user has audit roles (for AuditHead filtering)
      const hasAuditRole = session.roles.includes('AuditHead') ||
                           session.roles.includes('Auditor') ||
                           session.roles.includes('Auditor');

      const whereClause: Record<string, unknown> = {};

      if (isAuditee) {
        // Auditee can see evidence requests assigned to them OR from engagements where they are the auditee
        whereClause.OR = [
          { auditeeId: session.id },
          { engagement: { auditeeId: session.id } },
        ];
      } else if (hasAuditRole) {
        // AuditHead/Auditor/Auditor - filter through engagement
        whereClause.engagement = {
          ...tenantFilter,
          ...auditHeadFilter,
        };
      } else if (scopeFilter.departmentId) {
        // Department-scoped users see requests for their department's engagements
        whereClause.engagement = {
          ...tenantFilter,
          departmentId: scopeFilter.departmentId
        };
      } else {
        // Default: filter by tenant
        whereClause.engagement = tenantFilter;
      }

      if (status && status !== 'all') {
        whereClause.status = status;
      }

      if (search) {
        whereClause.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { engagement: { auditId: { contains: search, mode: 'insensitive' } } },
          { engagement: { engagementTitle: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const evidenceRequests = await prisma.fieldworkEvidenceRequest.findMany({
        where: whereClause,
        include: {
          engagement: {
            select: {
              id: true,
              auditId: true,
              engagementTitle: true,
              department: {
                select: {
                  id: true,
                  name: true,
                }
              },
              assignedAuditor: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                }
              }
            }
          },
          attachments: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json(evidenceRequests);
    } catch (error) {
      console.error('Error fetching fieldwork evidence requests:', error);
      return NextResponse.json(
        { error: 'Failed to fetch evidence requests' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

// POST /api/internal-audit/fieldwork - Create a new evidence request
export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const body = await req.json();

      const {
        engagementId,
        title,
        description,
        sampleSize,
        dueDate,
        auditeeId,
        auditeeName,
        status,
        priority,
        requestType,
        controlReference,
        testingProcedure,
        expectedEvidence,
        auditorNotes,
      } = body;

      // Validate required fields
      if (!engagementId) {
        return NextResponse.json(
          { error: 'Engagement is required' },
          { status: 400 }
        );
      }

      if (!title || !title.trim()) {
        return NextResponse.json(
          { error: 'Evidence title is required' },
          { status: 400 }
        );
      }

      // Verify engagement exists
      const engagement = await prisma.auditEngagement.findUnique({
        where: { id: engagementId },
      });

      if (!engagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      // Create evidence request
      const evidenceRequest = await prisma.fieldworkEvidenceRequest.create({
        data: {
          engagementId,
          title: title.trim(),
          description: description || null,
          sampleSize: sampleSize || null,
          dueDate: dueDate ? new Date(dueDate) : null,
          auditeeId: auditeeId || null,
          auditeeName: auditeeName || null,
          status: status || 'Pending',
        },
        include: {
          engagement: {
            select: {
              id: true,
              auditId: true,
              engagementTitle: true,
              department: {
                select: {
                  id: true,
                  name: true,
                }
              },
              assignedAuditor: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                }
              }
            }
          },
          attachments: true,
        },
      });

      return NextResponse.json(evidenceRequest, { status: 201 });
    } catch (error) {
      console.error('Error creating evidence request:', error);
      return NextResponse.json(
        { error: 'Failed to create evidence request' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'create' }
);
