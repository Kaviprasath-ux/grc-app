import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getCustomerAccountId } from '@/lib/api-auth';
import { notificationService, NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS } from '@/lib/notification-service';
import { sendEmail } from '@/lib/email-service';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Escape HTML and convert newlines to <br> for a plain-text body.
function bodyToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;white-space:pre-wrap">${escaped.replace(/\n/g, '<br>')}</div>`;
}

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

      const { recipientName, recipientEmail, additionalRecipients, subject, body: announcementBody, commenceDate } = body;
      const commenceDateValue = commenceDate ? new Date(commenceDate) : null;
      const sentAt = new Date();
      const additionalList: Array<{ name?: string; email?: string }> = Array.isArray(additionalRecipients)
        ? additionalRecipients
        : [];
      const additionalRecipientsJson = JSON.stringify(additionalList);

      const announcement = await prisma.auditEngagementAnnouncement.upsert({
        where: { engagementId: id },
        create: {
          customerAccountId,
          engagementId: id,
          recipientName: recipientName ?? null,
          recipientEmail: recipientEmail ?? null,
          additionalRecipients: additionalRecipientsJson,
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
          additionalRecipients: additionalRecipientsJson,
          subject: subject ?? null,
          body: announcementBody ?? null,
          commenceDate: commenceDateValue,
          status: 'Sent',
          sentAt,
          sentById: session.id,
          sentByName: session.name || null,
        },
      });

      // Email the announcement to all recipients (primary + additional), deduped.
      const emails = Array.from(
        new Set(
          [recipientEmail, ...additionalList.map((r) => r?.email)]
            .map((e) => (e || '').trim().toLowerCase())
            .filter((e) => EMAIL_RE.test(e))
        )
      );
      if (emails.length > 0 && announcement.subject) {
        try {
          await sendEmail({
            to: emails,
            subject: announcement.subject,
            html: bodyToHtml(announcement.body || ''),
          });
        } catch (emailError) {
          console.error('Error emailing announcement recipients:', emailError);
        }
      }

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
