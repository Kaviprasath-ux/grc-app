import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getCustomerAccountId } from '@/lib/api-auth';
import { notificationService, NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS } from '@/lib/notification-service';

// POST /api/internal-audit/engagements/[id]/announcement/send - Mark announcement Sent and notify the auditee
export const POST = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const body = await req.json().catch(() => ({}));
      const tenantFilter = getTenantFilter(session);

      // Verify engagement exists and belongs to tenant
      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true, auditeeId: true },
      });

      if (!engagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      if (!session.customerAccountId) {
        return NextResponse.json(
          { error: 'User does not have a customer account assigned' },
          { status: 400 }
        );
      }
      const customerAccountId = getCustomerAccountId(session);

      const { recipientName, recipientEmail, subject, body: announcementBody, commenceDate } = body;
      const commenceDateValue = commenceDate ? new Date(commenceDate) : null;
      const sentAt = new Date();

      const announcement = await prisma.auditEngagementAnnouncement.upsert({
        where: { engagementId: id },
        create: {
          customerAccountId,
          engagementId: id,
          recipientName: recipientName ?? null,
          recipientEmail: recipientEmail ?? null,
          subject: subject ?? null,
          body: announcementBody ?? null,
          commenceDate: commenceDateValue,
          status: 'Sent',
          sentAt,
          sentById: session.id,
          sentByName: session.name || null,
          createdById: session.id,
          createdByName: session.name || null,
        },
        update: {
          recipientName: recipientName ?? null,
          recipientEmail: recipientEmail ?? null,
          subject: subject ?? null,
          body: announcementBody ?? null,
          commenceDate: commenceDateValue,
          status: 'Sent',
          sentAt,
          sentById: session.id,
          sentByName: session.name || null,
        },
      });

      // Notify the auditee — do not let a notification failure fail the send
      if (engagement.auditeeId) {
        try {
          await notificationService.send({
            customerAccountId,
            actorId: session.id,
            recipientId: engagement.auditeeId,
            event: NOTIFICATION_EVENTS.AUDIT_PLAN_SCHEDULED,
            title: 'Internal Audit Announcement',
            message: announcement.subject || 'An internal audit announcement has been issued for your engagement.',
            relatedEntityType: 'engagement',
            relatedEntityId: id,
            link: `/internal-audit/fieldwork/${id}`,
            metadata: { engagementId: id },
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        } catch (notifyError) {
          console.error('Error sending announcement notification:', notifyError);
        }
      }

      return NextResponse.json(announcement);
    } catch (error) {
      console.error('Error sending engagement announcement:', error);
      return NextResponse.json(
        { error: 'Failed to send engagement announcement' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);
