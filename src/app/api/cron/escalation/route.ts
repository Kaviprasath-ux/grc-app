import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { notificationService, NOTIFICATION_EVENTS, NOTIFICATION_CHANNELS, NOTIFICATION_PRIORITIES } from '@/lib/notification-service';

/**
 * Escalation Cron Job API
 *
 * This endpoint checks for overdue items and sends escalation notifications:
 * 1. ESCALATE_FIELDWORK_RESPONSE — fieldwork evidence requests past due date by configured days
 * 2. CLARIFICATION_REMINDER — clarification requests pending past configured days
 * 3. ESCALATE_CLARIFICATION — clarification requests significantly overdue (2x threshold)
 * 4. ESCALATE_ACKNOWLEDGMENT — audit reports pending acknowledgment past configured days
 *
 * Should be called daily by a cron job (e.g., Vercel Cron, external scheduler)
 *
 * Security: Protected by CRON_SECRET environment variable (optional for dev)
 */

interface EscalationError {
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

  const now = new Date();
  const counts = {
    fieldworkResponse: 0,
    clarificationReminder: 0,
    clarificationEscalation: 0,
    acknowledgmentEscalation: 0,
  };
  const errors: EscalationError[] = [];

  console.log('[Escalation] Starting escalation processing...');

  try {
    // Load all escalation configs (per customer account)
    const escalationConfigs = await prisma.auditEscalationConfig.findMany();

    // Build a lookup map: customerAccountId -> config
    // Fall back to default values if no config exists for a customer
    const defaultConfig = {
      responseSubmission: 5,
      acknowledgement: 1,
      clarification: 2,
    };

    const configMap = new Map<string, typeof defaultConfig>();
    for (const cfg of escalationConfigs) {
      if (cfg.customerAccountId) {
        configMap.set(cfg.customerAccountId, {
          responseSubmission: cfg.responseSubmission,
          acknowledgement: cfg.acknowledgement,
          clarification: cfg.clarification,
        });
      }
    }

    // Helper: get config for a customer account
    const getConfig = (customerAccountId: string) =>
      configMap.get(customerAccountId) || defaultConfig;

    // Helper: calculate threshold date (now minus N days)
    const daysAgo = (days: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() - days);
      return d;
    };

    // ========== 1. ESCALATE FIELDWORK RESPONSE ==========
    // Find evidence requests that are overdue (past dueDate + responseSubmission days)
    // and still pending/in progress
    const pendingRequests = await prisma.fieldworkEvidenceRequest.findMany({
      where: {
        status: { in: ['Pending', 'In Progress'] },
        dueDate: { not: null },
        auditeeId: { not: null },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        auditeeId: true,
        engagement: {
          select: {
            id: true,
            customerAccountId: true,
            engagementTitle: true,
            auditHeadId: true,
            auditeeId: true,
          },
        },
      },
    });

    console.log(`[Escalation] Found ${pendingRequests.length} pending fieldwork evidence requests`);

    for (const req of pendingRequests) {
      if (!req.dueDate || !req.engagement) continue;

      const config = getConfig(req.engagement.customerAccountId);
      const threshold = daysAgo(config.responseSubmission);

      // Only escalate if dueDate is past the threshold
      if (req.dueDate > threshold) continue;

      // Escalate to audit head
      const recipientId = req.engagement.auditHeadId || req.engagement.auditeeId;
      if (!recipientId) continue;

      try {
        await notificationService.send({
          customerAccountId: req.engagement.customerAccountId,
          actorId: 'system',
          recipientId,
          event: NOTIFICATION_EVENTS.ESCALATE_FIELDWORK_RESPONSE,
          title: 'Fieldwork Response Overdue (Escalated)',
          message: `Fieldwork evidence request "${req.title}" for "${req.engagement.engagementTitle}" is overdue and has been escalated.`,
          relatedEntityType: 'fieldwork',
          relatedEntityId: req.id,
          link: `/internal-audit/fieldwork/${req.engagement.id}`,
          priority: NOTIFICATION_PRIORITIES.URGENT,
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          metadata: {
            auditName: req.engagement.engagementTitle,
            fieldworkItem: req.title,
            dueDate: req.dueDate.toLocaleDateString(),
            escalatedTo: 'Audit Head',
            entityName: req.title,
          },
        });
        counts.fieldworkResponse++;
      } catch (error) {
        console.error(`[Escalation] Failed to escalate fieldwork response ${req.id}:`, error);
        errors.push({
          entityType: 'fieldwork-response',
          entityId: req.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // ========== 2. CLARIFICATION REMINDER & ESCALATION ==========
    // Find evidence requests with pending clarifications
    const pendingClarifications = await prisma.fieldworkEvidenceRequest.findMany({
      where: {
        clarificationSentAt: { not: null },
        status: { notIn: ['Submitted', 'Reviewed'] },
        auditeeId: { not: null },
      },
      select: {
        id: true,
        title: true,
        clarificationSentAt: true,
        clarificationComment: true,
        auditeeId: true,
        engagement: {
          select: {
            id: true,
            customerAccountId: true,
            engagementTitle: true,
            auditHeadId: true,
          },
        },
      },
    });

    console.log(`[Escalation] Found ${pendingClarifications.length} pending clarification requests`);

    for (const req of pendingClarifications) {
      if (!req.clarificationSentAt || !req.auditeeId || !req.engagement) continue;

      const config = getConfig(req.engagement.customerAccountId);
      const reminderThreshold = daysAgo(config.clarification);
      const escalationThreshold = daysAgo(config.clarification * 2);

      if (req.clarificationSentAt <= escalationThreshold) {
        // Past 2x threshold — escalate to audit head
        const recipientId = req.engagement.auditHeadId;
        if (!recipientId) continue;

        try {
          await notificationService.send({
            customerAccountId: req.engagement.customerAccountId,
            actorId: 'system',
            recipientId,
            event: NOTIFICATION_EVENTS.ESCALATE_CLARIFICATION,
            title: 'Clarification Escalated',
            message: `Clarification for "${req.title}" in "${req.engagement.engagementTitle}" has not been responded to and is being escalated.`,
            relatedEntityType: 'fieldwork',
            relatedEntityId: req.id,
            link: `/internal-audit/fieldwork/${req.engagement.id}`,
            priority: NOTIFICATION_PRIORITIES.URGENT,
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
            metadata: {
              questionTitle: req.title,
              auditName: req.engagement.engagementTitle,
              escalatedTo: 'Audit Head',
              entityName: req.title,
            },
          });
          counts.clarificationEscalation++;
        } catch (error) {
          console.error(`[Escalation] Failed to escalate clarification ${req.id}:`, error);
          errors.push({
            entityType: 'clarification-escalation',
            entityId: req.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      } else if (req.clarificationSentAt <= reminderThreshold) {
        // Past threshold — send reminder to auditee
        try {
          await notificationService.send({
            customerAccountId: req.engagement.customerAccountId,
            actorId: 'system',
            recipientId: req.auditeeId,
            event: NOTIFICATION_EVENTS.CLARIFICATION_REMINDER,
            title: 'Clarification Reminder',
            message: `Reminder: Clarification is still required for "${req.title}" in "${req.engagement.engagementTitle}".`,
            relatedEntityType: 'fieldwork',
            relatedEntityId: req.id,
            link: `/internal-audit/fieldwork/${req.engagement.id}`,
            priority: NOTIFICATION_PRIORITIES.HIGH,
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
            metadata: {
              questionTitle: req.title,
              auditName: req.engagement.engagementTitle,
              entityName: req.title,
            },
          });
          counts.clarificationReminder++;
        } catch (error) {
          console.error(`[Escalation] Failed to send clarification reminder ${req.id}:`, error);
          errors.push({
            entityType: 'clarification-reminder',
            entityId: req.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    // ========== 3. ESCALATE ACKNOWLEDGMENT ==========
    // Find audit reports that have been published/sent to auditee
    // but not yet acknowledged (auditeeComment is null)
    const pendingAcknowledgments = await prisma.auditReport.findMany({
      where: {
        publishedAt: { not: null },
        auditeeId: { not: null },
        auditeeComment: null,
      },
      select: {
        id: true,
        reportCode: true,
        title: true,
        publishedAt: true,
        auditeeId: true,
        customerAccountId: true,
        auditHeadId: true,
        engagement: {
          select: {
            id: true,
            engagementTitle: true,
            plannedStartDate: true,
          },
        },
      },
    });

    console.log(`[Escalation] Found ${pendingAcknowledgments.length} reports pending acknowledgment`);

    for (const report of pendingAcknowledgments) {
      if (!report.publishedAt || !report.auditeeId) continue;

      const config = getConfig(report.customerAccountId);
      const threshold = daysAgo(config.acknowledgement);

      // Only escalate if published date is past the threshold
      if (report.publishedAt > threshold) continue;

      // Escalate to audit head
      const recipientId = report.auditHeadId || report.auditeeId;

      try {
        await notificationService.send({
          customerAccountId: report.customerAccountId,
          actorId: 'system',
          recipientId,
          event: NOTIFICATION_EVENTS.ESCALATE_ACKNOWLEDGMENT,
          title: 'Acknowledgement Escalated',
          message: `Audit report "${report.title}" has not been acknowledged and is being escalated.`,
          relatedEntityType: 'report',
          relatedEntityId: report.id,
          link: `/internal-audit/report/${report.engagement.id}`,
          priority: NOTIFICATION_PRIORITIES.URGENT,
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          metadata: {
            auditPlanName: report.engagement.engagementTitle || report.title,
            scheduledDate: report.engagement.plannedStartDate?.toLocaleDateString() || report.publishedAt.toLocaleDateString(),
            escalatedTo: 'Audit Head',
            entityName: report.title,
          },
        });
        counts.acknowledgmentEscalation++;
      } catch (error) {
        console.error(`[Escalation] Failed to escalate acknowledgment ${report.id}:`, error);
        errors.push({
          entityType: 'acknowledgment',
          entityId: report.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log('[Escalation] Processing complete:', counts);
    if (errors.length > 0) {
      console.warn(`[Escalation] Encountered ${errors.length} errors during processing`);
    }

    return NextResponse.json({
      success: true,
      message: 'Escalation processing complete',
      counts,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Escalation] Critical error during processing:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process escalations',
      message: error instanceof Error ? error.message : 'Unknown error',
      counts,
      errors: errors.length > 0 ? errors : undefined,
    }, { status: 500 });
  }
}
