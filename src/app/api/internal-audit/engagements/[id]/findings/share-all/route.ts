import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter } from '@/lib/api-auth';
import { notificationService, NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS } from '@/lib/notification-service';

// POST /api/internal-audit/engagements/[id]/findings/share-all
// Aggregated reporting: consolidate ALL of the engagement's findings into the
// draft detailed report and share them with the auditee in a single batch,
// sending ONE consolidated notification (vs. Continuous which shares each
// finding individually).
export const POST = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);

      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: {
          id: true,
          auditId: true,
          engagementTitle: true,
          auditeeId: true,
          customerAccountId: true,
        },
      });
      if (!engagement) {
        return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
      }

      const findings = await prisma.internalAuditFinding.findMany({
        where: { engagementId: id, ...tenantFilter },
        select: { id: true, sharedWithAuditeeAt: true },
      });

      if (findings.length === 0) {
        return NextResponse.json({ error: 'No findings to share' }, { status: 400 });
      }

      const now = new Date();
      await prisma.internalAuditFinding.updateMany({
        where: { engagementId: id, ...tenantFilter },
        data: { sharedWithAuditeeAt: now },
      });

      // Single consolidated notification to the auditee for the whole draft report
      const auditeeId = engagement.auditeeId;
      if (auditeeId && auditeeId !== session.id && engagement.customerAccountId) {
        try {
          await notificationService.send({
            customerAccountId: engagement.customerAccountId,
            actorId: session.id,
            recipientId: auditeeId,
            event: NOTIFICATION_EVENTS.FINDINGS_CREATED,
            title: 'Draft Detailed Report Shared',
            message: `The consolidated draft detailed report for ${engagement.auditId} - ${engagement.engagementTitle} (${findings.length} finding${findings.length === 1 ? '' : 's'}) has been shared with you.`,
            relatedEntityType: 'engagement',
            relatedEntityId: engagement.id,
            link: `/internal-audit/fieldwork/${engagement.id}`,
            metadata: { engagementId: engagement.id, findingCount: findings.length },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        } catch (notifyError) {
          console.error('Error sending aggregated report notification:', notifyError);
        }
      }

      return NextResponse.json({ shared: findings.length, total: findings.length, sharedAt: now });
    } catch (error) {
      console.error('Error sharing consolidated findings:', error);
      return NextResponse.json({ error: 'Failed to share consolidated findings' }, { status: 500 });
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);

// DELETE /api/internal-audit/engagements/[id]/findings/share-all
// Recall the consolidated draft: un-share all of the engagement's findings.
export const DELETE = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);

      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true },
      });
      if (!engagement) {
        return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
      }

      await prisma.internalAuditFinding.updateMany({
        where: { engagementId: id, ...tenantFilter },
        data: { sharedWithAuditeeAt: null },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error recalling consolidated findings:', error);
      return NextResponse.json({ error: 'Failed to recall consolidated findings' }, { status: 500 });
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);
