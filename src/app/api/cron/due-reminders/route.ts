import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { notificationService, NOTIFICATION_CHANNELS } from '@/lib/notification-service';

/**
 * Due Date Reminder Cron Job API
 *
 * This endpoint sends due date reminder notifications for:
 * 1. Evidence due tomorrow (EVIDENCE_DUE_REMINDER)
 * 2. CAPA/Findings due tomorrow (CAPA_DUE_REMINDER)
 * 3. Policy reviews due tomorrow (REVIEW_DUE_REMINDER)
 *
 * Should be called daily by a cron job (e.g., Vercel Cron, external scheduler)
 *
 * Security: Protected by CRON_SECRET environment variable (optional for dev)
 */

// Track errors but don't fail the entire batch
interface ReminderError {
  entityType: string;
  entityId: string;
  error: string;
}

export async function GET(req: NextRequest) {
  // Verify cron secret if set
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Calculate date range: today to tomorrow (end of day)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);

  const counts = {
    evidence: 0,
    capa: 0,
    review: 0,
  };

  const errors: ReminderError[] = [];

  console.log('[DueReminders] Starting due date reminder processing...');
  console.log(`[DueReminders] Date range: ${today.toISOString()} to ${tomorrow.toISOString()}`);

  try {
    // ========== 1. EVIDENCE DUE REMINDERS ==========
    // Find evidence due tomorrow that is not yet approved
    const evidencesDueSoon = await prisma.evidence.findMany({
      where: {
        dueDate: {
          gte: today,
          lte: tomorrow,
        },
        status: { not: 'Approved' },
        assigneeId: { not: null },
      },
      select: {
        id: true,
        customerAccountId: true,
        assigneeId: true,
        name: true,
        evidenceCode: true,
        dueDate: true,
        control: {
          select: { controlCode: true },
        },
      },
    });

    console.log(`[DueReminders] Found ${evidencesDueSoon.length} evidence items due soon`);

    for (const evidence of evidencesDueSoon) {
      if (!evidence.assigneeId || !evidence.dueDate) continue;

      try {
        await notificationService.notifyDueReminder({
          customerAccountId: evidence.customerAccountId,
          recipientId: evidence.assigneeId,
          entityType: 'evidence',
          entityId: evidence.id,
          entityName: evidence.control?.controlCode
            ? `${evidence.control.controlCode}: ${evidence.name}`
            : evidence.name,
          dueDate: evidence.dueDate,
          link: `/compliance/evidence/${evidence.id}`,
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
        counts.evidence++;
      } catch (error) {
        console.error(`[DueReminders] Failed to send evidence reminder for ${evidence.id}:`, error);
        errors.push({
          entityType: 'evidence',
          entityId: evidence.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // ========== 2. CAPA/FINDING DUE REMINDERS ==========
    // Find findings with target dates due tomorrow that are not yet closed
    const findingsDueSoon = await prisma.internalAuditFinding.findMany({
      where: {
        targetDate: {
          gte: today,
          lte: tomorrow,
        },
        status: { notIn: ['Closed', 'Verified'] },
      },
      select: {
        id: true,
        customerAccountId: true,
        findingId: true,
        finding: true,
        targetDate: true,
        responsiblePersonId: true,
        engagement: {
          select: {
            auditeeId: true,
            customerAccountId: true,
          },
        },
      },
    });

    console.log(`[DueReminders] Found ${findingsDueSoon.length} findings/CAPAs due soon`);

    for (const finding of findingsDueSoon) {
      // Use responsiblePersonId if set, otherwise fall back to auditee
      const recipientId = finding.responsiblePersonId || finding.engagement?.auditeeId;
      const customerAccountId = finding.customerAccountId || finding.engagement?.customerAccountId;

      if (!recipientId || !customerAccountId || !finding.targetDate) continue;

      try {
        await notificationService.notifyDueReminder({
          customerAccountId,
          recipientId,
          entityType: 'capa',
          entityId: finding.id,
          entityName: finding.finding || `Finding #${finding.findingId}`,
          dueDate: finding.targetDate,
          link: `/internal-audit/capa-tracking/${finding.id}`,
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
        counts.capa++;
      } catch (error) {
        console.error(`[DueReminders] Failed to send CAPA reminder for ${finding.id}:`, error);
        errors.push({
          entityType: 'capa',
          entityId: finding.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // ========== 3. POLICY REVIEW DUE REMINDERS ==========
    // Find policies with review dates due tomorrow that are not in draft status
    const policiesDueSoon = await prisma.policy.findMany({
      where: {
        reviewDate: {
          gte: today,
          lte: tomorrow,
        },
        status: { notIn: ['Draft', 'Not Uploaded'] },
        assigneeId: { not: null },
      },
      select: {
        id: true,
        customerAccountId: true,
        assigneeId: true,
        code: true,
        name: true,
        reviewDate: true,
      },
    });

    console.log(`[DueReminders] Found ${policiesDueSoon.length} policies due for review`);

    for (const policy of policiesDueSoon) {
      if (!policy.assigneeId || !policy.reviewDate) continue;

      try {
        await notificationService.notifyDueReminder({
          customerAccountId: policy.customerAccountId,
          recipientId: policy.assigneeId,
          entityType: 'review',
          entityId: policy.id,
          entityName: `${policy.code}: ${policy.name}`,
          dueDate: policy.reviewDate,
          link: `/compliance/governance/${policy.id}`,
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
        counts.review++;
      } catch (error) {
        console.error(`[DueReminders] Failed to send policy review reminder for ${policy.id}:`, error);
        errors.push({
          entityType: 'review',
          entityId: policy.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log('[DueReminders] Processing complete:', counts);
    if (errors.length > 0) {
      console.warn(`[DueReminders] Encountered ${errors.length} errors during processing`);
    }

    return NextResponse.json({
      success: true,
      message: 'Due date reminders sent',
      counts,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[DueReminders] Critical error during processing:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process due date reminders',
      message: error instanceof Error ? error.message : 'Unknown error',
      counts,
      errors: errors.length > 0 ? errors : undefined,
    }, { status: 500 });
  }
}
