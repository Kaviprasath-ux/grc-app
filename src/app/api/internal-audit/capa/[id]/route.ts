import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { notificationService, NOTIFICATION_EVENTS, NOTIFICATION_CHANNELS } from '@/lib/notification-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/internal-audit/capa/[id] - Get single CAPA
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const capa = await prisma.internalAuditCAPA.findUnique({
        where: { id },
        include: {
          finding: {
            select: {
              id: true,
              findingId: true,
              finding: true,
              description: true,
              severity: true,
              department: { select: { id: true, name: true } },
              responsiblePerson: true,
              engagement: {
                select: {
                  id: true,
                  auditId: true,
                  engagementTitle: true,
                }
              }
            }
          }
        },
      });

      if (!capa) {
        return NextResponse.json(
          { error: 'CAPA not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(capa);
    } catch (error) {
      console.error('Error fetching CAPA:', error);
      return NextResponse.json(
        { error: 'Failed to fetch CAPA' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.capa', action: 'view' }
);

// PUT /api/internal-audit/capa/[id] - Update CAPA (for auditee to respond)
export const PUT = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();

      const capa = await prisma.internalAuditCAPA.findUnique({
        where: { id },
        include: { finding: true }
      });

      if (!capa) {
        return NextResponse.json(
          { error: 'CAPA not found' },
          { status: 404 }
        );
      }

      const isAuditee = session.roles.includes('Auditee') &&
                        !session.roles.includes('AuditHead') &&
                        !session.roles.includes('Auditor');

      const updateData: Record<string, unknown> = {};

      if (isAuditee) {
        // Auditee can only update status and add evidence
        if (body.status && ['In Progress', 'Closed'].includes(body.status)) {
          updateData.status = body.status;
          if (body.status === 'Closed') {
            updateData.completedDate = new Date();
          }
        }
        if (body.evidenceFilePath) updateData.evidenceFilePath = body.evidenceFilePath;
        if (body.evidenceFileName) updateData.evidenceFileName = body.evidenceFileName;
      } else {
        // Auditors can update all fields
        if (body.title) updateData.title = body.title;
        if (body.description) updateData.description = body.description;
        if (body.actionType) updateData.actionType = body.actionType;
        if (body.responsiblePerson) updateData.responsiblePerson = body.responsiblePerson;
        if (body.targetDate) updateData.targetDate = new Date(body.targetDate);
        if (body.status) {
          updateData.status = body.status;
          if (body.status === 'Closed') {
            updateData.completedDate = new Date();
          }
        }
        if (body.evidenceFilePath) updateData.evidenceFilePath = body.evidenceFilePath;
        if (body.evidenceFileName) updateData.evidenceFileName = body.evidenceFileName;
      }

      const updated = await prisma.internalAuditCAPA.update({
        where: { id },
        data: updateData,
        include: {
          finding: {
            select: {
              id: true,
              findingId: true,
              finding: true,
              responsiblePersonId: true,
              engagement: {
                select: { auditId: true, engagementTitle: true, customerAccountId: true }
              }
            }
          }
        }
      });

      // Send CAPA notifications based on status changes
      const customerAccountId = updated.finding?.engagement?.customerAccountId;
      if (customerAccountId && body.status && body.status !== capa.status) {
        // Get the responsible person to notify
        const responsiblePersonId = updated.finding?.responsiblePersonId;

        // Notify when CAPA is closed
        if (body.status === 'Closed' && responsiblePersonId && responsiblePersonId !== session.id) {
          await notificationService.send({
            customerAccountId,
            actorId: session.id,
            recipientId: responsiblePersonId,
            event: NOTIFICATION_EVENTS.FINDINGS_COMPLETED,
            title: 'CAPA Closed',
            message: `CAPA "${updated.capaId}: ${updated.title}" has been closed.`,
            relatedEntityType: 'capa',
            relatedEntityId: updated.id,
            link: `/internal-audit/capa-tracking`,
            metadata: {
              capaId: updated.capaId,
              capaTitle: updated.title,
              findingId: updated.finding?.findingId,
              closedBy: session.name || 'Auditor',
            },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }

        // Notify when CAPA is assigned/in progress
        if (body.status === 'In Progress' && responsiblePersonId && responsiblePersonId !== session.id) {
          await notificationService.send({
            customerAccountId,
            actorId: session.id,
            recipientId: responsiblePersonId,
            event: NOTIFICATION_EVENTS.CAPA_ASSIGNED,
            title: 'CAPA In Progress',
            message: `CAPA "${updated.capaId}: ${updated.title}" is now in progress and requires your action.`,
            relatedEntityType: 'capa',
            relatedEntityId: updated.id,
            link: `/internal-audit/capa-tracking`,
            metadata: {
              capaId: updated.capaId,
              capaTitle: updated.title,
              findingId: updated.finding?.findingId,
              targetDate: updated.targetDate,
            },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }
      }

      return NextResponse.json(updated);
    } catch (error) {
      console.error('Error updating CAPA:', error);
      return NextResponse.json(
        { error: 'Failed to update CAPA' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.capa', action: 'edit' }
);
