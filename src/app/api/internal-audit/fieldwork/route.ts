import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getDataScopeFilter } from '@/lib/api-auth';

// GET /api/internal-audit/fieldwork - Get fieldwork evidence requests
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status');
      const search = searchParams.get('search');

      // Build where clause based on user's scope
      const scopeFilter = getDataScopeFilter(session, 'audit.fieldwork', 'view');

      // For Auditee role, filter by auditeeId (their user ID)
      const isAuditee = session.roles.includes('Auditee') &&
                        !session.roles.includes('AuditHead') &&
                        !session.roles.includes('Auditor');

      const whereClause: Record<string, unknown> = {};

      if (isAuditee) {
        // Auditee can only see evidence requests assigned to them
        whereClause.auditeeId = session.id;
      } else if (scopeFilter.departmentId) {
        // Department-scoped users see requests for their department's engagements
        whereClause.engagement = {
          departmentId: scopeFilter.departmentId
        };
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
