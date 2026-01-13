import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, canAccessRecord } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/internal-audit/fieldwork/[id] - Get single evidence request
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const evidenceRequest = await prisma.fieldworkEvidenceRequest.findUnique({
        where: { id },
        include: {
          engagement: {
            select: {
              id: true,
              auditId: true,
              engagementTitle: true,
              departmentId: true,
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

      if (!evidenceRequest) {
        return NextResponse.json(
          { error: 'Evidence request not found' },
          { status: 404 }
        );
      }

      // Check access - Auditee can only see their assigned requests
      const isAuditee = session.roles.includes('Auditee') &&
                        !session.roles.includes('AuditHead') &&
                        !session.roles.includes('Auditor');

      if (isAuditee && evidenceRequest.auditeeId !== session.id) {
        return NextResponse.json(
          { error: 'You do not have access to this evidence request' },
          { status: 403 }
        );
      }

      return NextResponse.json(evidenceRequest);
    } catch (error) {
      console.error('Error fetching evidence request:', error);
      return NextResponse.json(
        { error: 'Failed to fetch evidence request' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

// PUT /api/internal-audit/fieldwork/[id] - Update evidence request (submit response)
export const PUT = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();

      const evidenceRequest = await prisma.fieldworkEvidenceRequest.findUnique({
        where: { id },
        include: { engagement: true }
      });

      if (!evidenceRequest) {
        return NextResponse.json(
          { error: 'Evidence request not found' },
          { status: 404 }
        );
      }

      // Check access - Auditee can only update their assigned requests
      const isAuditee = session.roles.includes('Auditee') &&
                        !session.roles.includes('AuditHead') &&
                        !session.roles.includes('Auditor');

      if (isAuditee && evidenceRequest.auditeeId !== session.id) {
        return NextResponse.json(
          { error: 'You do not have access to update this evidence request' },
          { status: 403 }
        );
      }

      // Auditee can only update status to "Submitted" and add attachments
      const updateData: Record<string, unknown> = {};

      if (isAuditee) {
        // Auditee can only submit (change status to Submitted)
        if (body.status === 'Submitted') {
          updateData.status = 'Submitted';
        }
      } else {
        // Auditors/Audit Head can update all fields
        if (body.status) updateData.status = body.status;
        if (body.title) updateData.title = body.title;
        if (body.description) updateData.description = body.description;
        if (body.sampleSize) updateData.sampleSize = body.sampleSize;
        if (body.dueDate) updateData.dueDate = new Date(body.dueDate);
        if (body.aiReviewStatus) updateData.aiReviewStatus = body.aiReviewStatus;
        if (body.aiReviewComment) updateData.aiReviewComment = body.aiReviewComment;
        if (body.auditeeId) {
          updateData.auditeeId = body.auditeeId;
          updateData.auditeeName = body.auditeeName;
        }
      }

      const updated = await prisma.fieldworkEvidenceRequest.update({
        where: { id },
        data: updateData,
        include: {
          engagement: {
            select: {
              id: true,
              auditId: true,
              engagementTitle: true,
              department: { select: { id: true, name: true } },
            }
          },
          attachments: true,
        }
      });

      return NextResponse.json(updated);
    } catch (error) {
      console.error('Error updating evidence request:', error);
      return NextResponse.json(
        { error: 'Failed to update evidence request' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);
