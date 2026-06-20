import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter } from '@/lib/api-auth';
import { notificationService, NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS } from '@/lib/notification-service';

// POST /api/internal-audit/findings/[findingId]/share - Share a finding with the auditee (continuous reporting)
export const POST = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ findingId: string }> }, session) => {
    try {
      const { findingId } = await params;
      const tenantFilter = getTenantFilter(session);

      // Verify finding exists and belongs to tenant
      const finding = await prisma.internalAuditFinding.findFirst({
        where: { id: findingId, ...tenantFilter },
        include: {
          engagement: {
            select: { id: true, auditId: true, engagementTitle: true, auditeeId: true, reportingMode: true },
          },
        },
      });

      if (!finding) {
        return NextResponse.json(
          { error: 'Finding not found' },
          { status: 404 }
        );
      }

      // Individual sharing is only valid under Continuous reporting. In
      // Aggregated mode findings are communicated together via the
      // consolidated draft report (share-all endpoint).
      if (finding.engagement?.reportingMode === 'Aggregated') {
        return NextResponse.json(
          { error: 'Engagement is in Aggregated reporting mode; share the consolidated draft report instead.' },
          { status: 409 }
        );
      }

      const updated = await prisma.internalAuditFinding.update({
        where: { id: findingId },
        data: { sharedWithAuditeeAt: new Date() },
        select: { id: true, findingId: true, sharedWithAuditeeAt: true },
      });

      // Notify the auditee that a finding has been shared with them
      const auditeeId = finding.engagement?.auditeeId;
      if (auditeeId && auditeeId !== session.id && finding.customerAccountId) {
        try {
          await notificationService.send({
            customerAccountId: finding.customerAccountId,
            actorId: session.id,
            recipientId: auditeeId,
            event: NOTIFICATION_EVENTS.FINDINGS_CREATED,
            title: 'Audit Finding Shared',
            message: `Finding ${finding.findingId} has been shared with you: ${finding.finding}`,
            relatedEntityType: 'finding',
            relatedEntityId: finding.id,
            link: `/internal-audit/fieldwork/${finding.engagement?.id}`,
            metadata: { findingId: finding.findingId },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        } catch (notifyError) {
          console.error('Error sending finding shared notification:', notifyError);
        }
      }

      return NextResponse.json(updated);
    } catch (error) {
      console.error('Error sharing finding:', error);
      return NextResponse.json(
        { error: 'Failed to share finding' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);

// DELETE /api/internal-audit/findings/[findingId]/share - Un-share a finding with the auditee
export const DELETE = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ findingId: string }> }, session) => {
    try {
      const { findingId } = await params;
      const tenantFilter = getTenantFilter(session);

      // Verify finding exists and belongs to tenant
      const finding = await prisma.internalAuditFinding.findFirst({
        where: { id: findingId, ...tenantFilter },
        select: { id: true },
      });

      if (!finding) {
        return NextResponse.json(
          { error: 'Finding not found' },
          { status: 404 }
        );
      }

      await prisma.internalAuditFinding.update({
        where: { id: findingId },
        data: { sharedWithAuditeeAt: null },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error un-sharing finding:', error);
      return NextResponse.json(
        { error: 'Failed to un-share finding' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);
