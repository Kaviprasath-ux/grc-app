/**
 * Notification Service
 *
 * CORE PURPOSE:
 * The in-app inbox notification system is ONLY meant to notify users about
 * actions that happen outside their immediate awareness.
 *
 * This system does NOT replace toasters:
 * - Toasters = immediate feedback when user performs action themselves
 * - Inbox notifications = actions by OTHERS that user wouldn't otherwise know about
 *
 * EVENTS THAT CREATE INBOX NOTIFICATIONS:
 * 1. User & Account Events: Customer onboarding, user creation
 * 2. Assignment-Based Events: When responsibility is assigned to a user
 * 3. Interaction Events: Comments, send-backs, approvals, feedback requests
 *
 * EVENTS THAT DO NOT CREATE INBOX NOTIFICATIONS:
 * - Generic entity creation (without assignment)
 * - System/helper/background operations
 * - When actor and receiver are the same user (self-actions)
 * - Actions already visible to the acting user
 *
 * ARCHITECTURAL NOTES:
 * - Centralized and reusable notification creation
 * - Event-driven, not scattered across UI logic
 * - Multi-channel: Both Inbox and Email by default (via NotificationChannel)
 * - Decoupled from UI pages and widgets
 */

import { prisma } from '@/lib/prisma';
import { sendTemplatedEmail, getUserInfo, TemplatePlaceholders } from './email-service';
import { getAppUrl } from '@/config/app-url';
import { getModuleFromPath, getModuleHome, type ModuleCode } from '@/lib/url-module-map';

/** Human-readable workspace names, used in per-module welcome notifications. */
const MODULE_LABELS: Record<ModuleCode, string> = {
  GRC: 'GRC',
  TPRM: 'TPRM',
  INTERNAL_AUDIT: 'Internal Audit',
  TECHNICAL_EVIDENCE: 'Technical Evidence',
};

// Import constants from the client-safe constants file
// This keeps all constants in one place and allows client code to import from there
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  NOTIFICATION_PRIORITIES,
  type NotificationChannel,
  type NotificationEvent,
  type NotificationPriority,
} from './notification-constants';

// Re-export for backwards compatibility with existing imports
export {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  NOTIFICATION_PRIORITIES,
  type NotificationChannel,
  type NotificationEvent,
  type NotificationPriority,
};

// ==================== INTERFACES ====================

export interface NotificationPayload {
  /** Customer account ID for multi-tenant isolation */
  customerAccountId: string;
  /** The user performing the action (actor) */
  actorId: string;
  /** The user receiving the notification (recipient) */
  recipientId: string;
  /** Notification event type */
  event: NotificationEvent;
  /** Notification title (short, shown in header) */
  title: string;
  /** Notification message (detailed, shown in dropdown) */
  message: string;
  /** Related entity type (e.g., 'evidence', 'risk', 'audit') */
  relatedEntityType?: string;
  /** Related entity ID */
  relatedEntityId?: string;
  /** Link to navigate when notification is clicked */
  link?: string;
  /**
   * Platform/module this notification belongs to. Scopes the in-app inbox per
   * workspace. When omitted, it is auto-derived from `link` (e.g. a `/tprm/...`
   * link → TPRM). Pass explicitly for link-less notifications (welcome,
   * account-created) where the module can't be inferred from a URL.
   */
  module?: ModuleCode;
  /** Priority level */
  priority?: NotificationPriority;
  /** Additional metadata (JSON) */
  metadata?: Record<string, unknown>;
  /** Channels to send notification through (default: inbox only) */
  channels?: NotificationChannel[];
}

export interface BulkNotificationPayload extends Omit<NotificationPayload, 'recipientId'> {
  /** Array of recipient user IDs */
  recipientIds: string[];
}

/**
 * Resolve the module a notification belongs to.
 * Prefers an explicit `module`, otherwise derives it from the `link` URL
 * prefix. Returns null when it can't be determined (link-less / cross-cutting),
 * in which case the notification is shown in every workspace.
 */
function resolveModule(payload: { module?: ModuleCode; link?: string }): ModuleCode | null {
  if (payload.module) return payload.module;
  if (payload.link) {
    const fromLink = getModuleFromPath(payload.link);
    // getModuleFromPath can return "SYSTEM" — that's not a customer workspace,
    // so treat it as undeterminable (null).
    if (fromLink && fromLink !== 'SYSTEM') return fromLink;
  }
  return null;
}

// ==================== VALIDATION HELPERS ====================

/**
 * Validates if a notification should be created.
 * Returns error message if invalid, null if valid.
 */
function validateNotification(payload: NotificationPayload): string | null {
  // RULE: Never notify the actor about their own action
  if (payload.actorId === payload.recipientId) {
    return 'Self-notification prevented: actor and recipient are the same user';
  }

  // RULE: Required fields
  if (!payload.customerAccountId) {
    return 'Missing customerAccountId';
  }
  if (!payload.recipientId) {
    return 'Missing recipientId';
  }
  if (!payload.event) {
    return 'Missing event type';
  }
  if (!payload.title || !payload.message) {
    return 'Missing title or message';
  }

  return null; // Valid
}

// ==================== NOTIFICATION SERVICE CLASS ====================

class NotificationService {
  /**
   * Create a notification through specified channels.
   *
   * IMPORTANT: This method validates that actor !== recipient.
   * Self-notifications are automatically prevented.
   */
  async send(payload: NotificationPayload): Promise<{ success: boolean; error?: string; notificationId?: string }> {
    // Validate notification
    const validationError = validateNotification(payload);
    if (validationError) {
      console.log(`[NotificationService] Skipped: ${validationError}`);
      return { success: false, error: validationError };
    }

    // Default to both INBOX and EMAIL channels for all notifications
    const channels = payload.channels || [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL];
    console.log(`[NotificationService] Sending notification - Event: ${payload.event}, Channels: ${channels.join(', ')}`);
    console.log(`[NotificationService] Payload channels param:`, payload.channels);

    try {
      let notificationId: string | undefined;

      // Process each channel
      for (const channel of channels) {
        switch (channel) {
          case NOTIFICATION_CHANNELS.INBOX:
            const notification = await this.createInboxNotification(payload);
            notificationId = notification.id;
            break;

          case NOTIFICATION_CHANNELS.EMAIL:
            await this.sendEmailNotification(payload);
            break;

          default:
            console.warn(`[NotificationService] Unknown channel: ${channel}`);
        }
      }

      return { success: true, notificationId };
    } catch (error) {
      console.error('[NotificationService] Error sending notification:', error);
      return { success: false, error: 'Failed to send notification' };
    }
  }

  /**
   * Send notifications to multiple recipients.
   * Automatically filters out the actor from recipients.
   */
  async sendBulk(payload: BulkNotificationPayload): Promise<{ success: boolean; count: number }> {
    // Filter out the actor from recipients (prevent self-notification)
    const validRecipients = payload.recipientIds.filter(id => id !== payload.actorId);

    if (validRecipients.length === 0) {
      console.log('[NotificationService] No valid recipients after filtering actor');
      return { success: true, count: 0 };
    }

    // Default to both INBOX and EMAIL channels for bulk notifications
    const channels = payload.channels || [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL];
    let successCount = 0;

    try {
      for (const channel of channels) {
        switch (channel) {
          case NOTIFICATION_CHANNELS.INBOX:
            const bulkModule = resolveModule(payload);
            const result = await prisma.notification.createMany({
              data: validRecipients.map(recipientId => ({
                customerAccountId: payload.customerAccountId,
                userId: recipientId,
                type: payload.event,
                module: bulkModule,
                title: payload.title,
                message: payload.message,
                relatedEntityType: payload.relatedEntityType,
                relatedEntityId: payload.relatedEntityId,
                link: payload.link,
                priority: payload.priority || NOTIFICATION_PRIORITIES.NORMAL,
                metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
              })),
            });
            successCount = result.count;
            break;

          case NOTIFICATION_CHANNELS.EMAIL:
            // Send email to each recipient
            for (const recipientId of validRecipients) {
              await this.sendEmailNotification({
                ...payload,
                recipientId,
              });
            }
            break;
        }
      }

      return { success: true, count: successCount };
    } catch (error) {
      console.error('[NotificationService] Error sending bulk notifications:', error);
      return { success: false, count: 0 };
    }
  }

  /**
   * Create inbox notification in database
   */
  private async createInboxNotification(payload: NotificationPayload) {
    return prisma.notification.create({
      data: {
        customerAccountId: payload.customerAccountId,
        userId: payload.recipientId,
        type: payload.event,
        module: resolveModule(payload),
        title: payload.title,
        message: payload.message,
        relatedEntityType: payload.relatedEntityType,
        relatedEntityId: payload.relatedEntityId,
        link: payload.link,
        priority: payload.priority || NOTIFICATION_PRIORITIES.NORMAL,
        metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
      },
    });
  }

  /**
   * Send email notification using the email service.
   * Maps notification events to email template codes.
   * Respects customer account email notifications toggle (non-mandatory emails).
   */
  private async sendEmailNotification(payload: NotificationPayload): Promise<void> {
    console.log('[NotificationService] sendEmailNotification called for event:', payload.event);
    console.log('[NotificationService] Recipient:', payload.recipientId);

    try {
      // Check if customer account has email notifications enabled
      const customerAccount = await prisma.customerAccount.findUnique({
        where: { id: payload.customerAccountId },
        select: { emailNotificationsEnabled: true, name: true },
      });

      console.log('[NotificationService] Customer account:', customerAccount?.name, '- Email enabled:', customerAccount?.emailNotificationsEnabled);

      // If email notifications are disabled for this customer, skip sending
      // Note: All notifications are currently non-mandatory
      if (customerAccount && !customerAccount.emailNotificationsEnabled) {
        console.log('[NotificationService] Email notifications DISABLED for customer account:', payload.customerAccountId);
        return;
      }

      // Get recipient info
      const userInfo = await getUserInfo(payload.recipientId);
      if (!userInfo) {
        console.log('[NotificationService] Cannot send email - user not found:', payload.recipientId);
        return;
      }

      // Auto-resolve actor info if not provided in metadata
      let actorName = payload.metadata?.actorName as string | undefined;
      let senderUsername: string | undefined;
      if (payload.actorId && payload.actorId !== 'system') {
        const actorInfo = await getUserInfo(payload.actorId);
        if (!actorName) actorName = actorInfo?.name;
        senderUsername = actorInfo?.userName;
      }

      // Map notification event to email template code
      const templateCode = this.getEmailTemplateCode(payload.event);

      // Build entity link with emailUser param for login pre-fill
      const baseUrl = getAppUrl();
      let entityLink: string | undefined;
      if (payload.link) {
        const linkUrl = new URL(payload.link, baseUrl);
        linkUrl.searchParams.set('emailUser', userInfo.userName);
        entityLink = linkUrl.toString();
      }

      // Build placeholders for the template
      const placeholders: TemplatePlaceholders = {
        title: payload.title,
        message: payload.message,
        entityLink,
        entityType: payload.relatedEntityType,
        entityName: payload.metadata?.entityName as string,
        actorName: actorName,
        senderUsername: senderUsername,
        recipientUsername: userInfo.userName,
        dueDate: payload.metadata?.dueDate as string,
        controlCode: payload.metadata?.controlCode as string,
        riskCode: payload.metadata?.riskCode as string,
        capaCode: payload.metadata?.capaCode as string,
        ...payload.metadata,
      };

      await sendTemplatedEmail(
        templateCode,
        userInfo.email,
        placeholders,
        userInfo.name
      );

      console.log('[NotificationService] Email sent to:', userInfo.email);
    } catch (error) {
      console.error('[NotificationService] Failed to send email:', error);
      // Don't throw - email failure shouldn't break the notification flow
    }
  }

  /**
   * Map notification events to email template codes.
   * Each event maps to a specific email template from the database.
   * Based on 73 English templates from VerifAI UAT system.
   */
  private getEmailTemplateCode(event: NotificationEvent): string {
    const templateMap: Record<NotificationEvent, string> = {
      // ===================== INTERNAL AUDIT =====================
      [NOTIFICATION_EVENTS.AUDIT_CREATED]: 'AUDIT_CREATED',
      [NOTIFICATION_EVENTS.FINDINGS_CREATED]: 'FINDINGS_CREATED',
      [NOTIFICATION_EVENTS.FINDINGS_COMPLETED]: 'FINDINGS_COMPLETED',
      [NOTIFICATION_EVENTS.AUDIT_PLAN_CREATED]: 'AUDIT_PLAN_CREATED',
      [NOTIFICATION_EVENTS.AUDIT_PLAN_SCHEDULED]: 'AUDIT_PLAN_SCHEDULED',
      [NOTIFICATION_EVENTS.AUDIT_PLAN_APPROVAL]: 'AUDIT_PLAN_APPROVAL',
      [NOTIFICATION_EVENTS.AUDIT_PLAN_ACKNOWLEDGED]: 'AUDIT_PLAN_ACKNOWLEDGED',
      [NOTIFICATION_EVENTS.AUDIT_PLAN_ACKNOWLEDGEMENT_REMINDER]: 'AUDIT_PLAN_ACKNOWLEDGEMENT_REMINDER',
      [NOTIFICATION_EVENTS.WORKPAPER_SUBMITTED]: 'WORKPAPER_SUBMITTED',
      [NOTIFICATION_EVENTS.PROCEDURE_ASSIGNED]: 'PROCEDURE_ASSIGNED',
      [NOTIFICATION_EVENTS.QUESTION_DELEGATED]: 'QUESTION_DELEGATED',
      [NOTIFICATION_EVENTS.QUESTION_CLARIFICATION]: 'QUESTION_CLARIFICATION',
      [NOTIFICATION_EVENTS.CONCLUDE_TEST]: 'CONCLUDE_TEST',
      [NOTIFICATION_EVENTS.RESPONSE_SUBMITTED]: 'RESPONSE_SUBMITTED',
      [NOTIFICATION_EVENTS.INTERVIEW_SCHEDULED]: 'INTERVIEW_SCHEDULED',
      [NOTIFICATION_EVENTS.INTERVIEW_RESCHEDULED]: 'INTERVIEW_RESCHEDULED',
      [NOTIFICATION_EVENTS.PERIODICITY_INITIATED]: 'PERIODICITY_INITIATED',
      [NOTIFICATION_EVENTS.REPORT_PUBLISHED]: 'REPORT_PUBLISHED',
      [NOTIFICATION_EVENTS.REPORT_INITIATED]: 'REPORT_INITIATED',
      [NOTIFICATION_EVENTS.REPORT_SUBMISSION]: 'REPORT_SUBMISSION',
      [NOTIFICATION_EVENTS.FIELDWORK_RESPONSE]: 'FIELDWORK_RESPONSE',
      [NOTIFICATION_EVENTS.FIELDWORK_RESPONSE_REMINDER]: 'FIELDWORK_RESPONSE_REMINDER',

      // ===================== EVIDENCE MANAGEMENT =====================
      [NOTIFICATION_EVENTS.EVIDENCE_ASSIGNED]: 'EVIDENCE_ASSIGNED',
      [NOTIFICATION_EVENTS.EVIDENCE_SUBMITTED]: 'EVIDENCE_SUBMITTED',
      [NOTIFICATION_EVENTS.EVIDENCE_PUBLISHED]: 'EVIDENCE_PUBLISHED',

      // ===================== GOVERNANCE & POLICY =====================
      [NOTIFICATION_EVENTS.GOVERNANCE_APPROVED]: 'GOVERNANCE_APPROVED',
      [NOTIFICATION_EVENTS.GOVERNANCE_ASSIGNED]: 'GOVERNANCE_ASSIGNED',
      [NOTIFICATION_EVENTS.GOVERNANCE_PUBLISHED]: 'GOVERNANCE_PUBLISHED',
      [NOTIFICATION_EVENTS.GOVERNANCE_SUBMIT_FOR_APPROVAL]: 'GOVERNANCE_SUBMIT_FOR_APPROVAL',
      [NOTIFICATION_EVENTS.GOVERNANCE_APPROVER]: 'GOVERNANCE_APPROVER',
      [NOTIFICATION_EVENTS.RESEND_POLICY]: 'RESEND_POLICY',
      [NOTIFICATION_EVENTS.POLICY_ASSIGNED]: 'POLICY_ASSIGNED',

      // ===================== PROCESS MANAGEMENT =====================
      [NOTIFICATION_EVENTS.PROCESS_CREATED]: 'PROCESS_CREATED',
      [NOTIFICATION_EVENTS.PROCESS_ASSIGNED]: 'PROCESS_ASSIGNED',
      [NOTIFICATION_EVENTS.PROCESS_SUBMIT_FOR_APPROVAL]: 'PROCESS_SUBMIT_FOR_APPROVAL',
      [NOTIFICATION_EVENTS.PROCESS_APPROVED]: 'PROCESS_APPROVED',
      [NOTIFICATION_EVENTS.PROCESS_REJECTION]: 'PROCESS_REJECTION',

      // ===================== RISK MANAGEMENT =====================
      [NOTIFICATION_EVENTS.RISK_CREATED]: 'RISK_CREATED',
      [NOTIFICATION_EVENTS.RISK_ASSIGNED]: 'RISK_ASSIGNED',
      [NOTIFICATION_EVENTS.RISK_APPROVED]: 'RISK_APPROVED',
      [NOTIFICATION_EVENTS.RISK_SUBMIT_FOR_APPROVAL]: 'RISK_SUBMIT_FOR_APPROVAL',
      [NOTIFICATION_EVENTS.RISK_REJECTION]: 'RISK_REJECTION',

      // ===================== CONTROL MANAGEMENT =====================
      [NOTIFICATION_EVENTS.CONTROL_ASSIGNED]: 'CONTROL_ASSIGNED',
      [NOTIFICATION_EVENTS.CONTROL_COMPLIANT]: 'CONTROL_COMPLIANT',
      [NOTIFICATION_EVENTS.ASSESSMENT_COMPLETED]: 'ASSESSMENT_COMPLETED',

      // ===================== ASSET MANAGEMENT =====================
      [NOTIFICATION_EVENTS.ASSET_ASSIGNED]: 'ASSET_ASSIGNED',

      // ===================== EXCEPTION MANAGEMENT =====================
      [NOTIFICATION_EVENTS.EXCEPTION_ASSIGNED]: 'EXCEPTION_ASSIGNED',
      [NOTIFICATION_EVENTS.EXCEPTION_AUTHORIZED]: 'EXCEPTION_AUTHORIZED',
      [NOTIFICATION_EVENTS.EXCEPTION_AUTHORIZATION_REQUIRED]: 'EXCEPTION_AUTHORIZATION_REQUIRED',
      [NOTIFICATION_EVENTS.EXCEPTION_APPROVED]: 'EXCEPTION_APPROVED',
      [NOTIFICATION_EVENTS.EXCEPTION_DENIED]: 'EXCEPTION_DENIED',
      [NOTIFICATION_EVENTS.EXCEPTION_SENT_BACK]: 'EXCEPTION_SENT_BACK',
      [NOTIFICATION_EVENTS.EXCEPTION_CLOSURE]: 'EXCEPTION_CLOSURE',
      [NOTIFICATION_EVENTS.EXCEPTION_CLOSED]: 'EXCEPTION_CLOSED',

      // ===================== ISSUE/FINDING TRACKING =====================
      [NOTIFICATION_EVENTS.ISSUE_CREATED]: 'ISSUE_CREATED',
      [NOTIFICATION_EVENTS.ISSUE_RESOLVED]: 'ISSUE_RESOLVED',
      [NOTIFICATION_EVENTS.ISSUE_SUBMIT_FOR_CLOSURE]: 'ISSUE_SUBMIT_FOR_CLOSURE',
      [NOTIFICATION_EVENTS.ISSUE_REJECTED]: 'ISSUE_REJECTED',
      [NOTIFICATION_EVENTS.ISSUE_RESOLUTION_REMINDER]: 'ISSUE_RESOLUTION_REMINDER',
      [NOTIFICATION_EVENTS.ISSUE_ESCALATED]: 'ISSUE_ESCALATED',
      [NOTIFICATION_EVENTS.ISSUE_EVIDENCE]: 'ISSUE_EVIDENCE',

      // ===================== PLANNED ACTIONS =====================
      [NOTIFICATION_EVENTS.PLANNED_ACTION_RAISE]: 'PLANNED_ACTION_RAISE',
      [NOTIFICATION_EVENTS.PLANNED_ACTION_REJECTION]: 'PLANNED_ACTION_REJECTION',
      [NOTIFICATION_EVENTS.PLANNED_ACTION_SUBMIT_FOR_APPROVAL]: 'PLANNED_ACTION_SUBMIT_FOR_APPROVAL',
      [NOTIFICATION_EVENTS.PLANNED_ACTION_APPROVED]: 'PLANNED_ACTION_APPROVED',

      // ===================== KPI =====================
      [NOTIFICATION_EVENTS.KPI_UPDATED]: 'KPI_UPDATED',
      [NOTIFICATION_EVENTS.KPI_SCORE_UPDATED]: 'KPI_SCORE_UPDATED',

      // ===================== USER & SYSTEM =====================
      [NOTIFICATION_EVENTS.USER_CREATED]: 'USER_CREATED',
      [NOTIFICATION_EVENTS.CUSTOMER_ONBOARDED]: 'CUSTOMER_ONBOARDED',
      [NOTIFICATION_EVENTS.SYSTEM_ANNOUNCEMENT]: 'SYSTEM_ANNOUNCEMENT',

      // ===================== ENGAGEMENT =====================
      [NOTIFICATION_EVENTS.ENGAGEMENT_ASSIGNED]: 'ENGAGEMENT_ASSIGNED',

      // ===================== CAPA =====================
      [NOTIFICATION_EVENTS.CAPA_ASSIGNED]: 'CAPA_ASSIGNED',

      // ===================== WORKFLOW EVENTS =====================
      [NOTIFICATION_EVENTS.COMMENT_ADDED]: 'COMMENT_ADDED',
      [NOTIFICATION_EVENTS.APPROVAL_REQUESTED]: 'APPROVAL_REQUESTED',
      [NOTIFICATION_EVENTS.APPROVAL_GRANTED]: 'APPROVAL_GRANTED',
      [NOTIFICATION_EVENTS.APPROVAL_DENIED]: 'APPROVAL_DENIED',
      [NOTIFICATION_EVENTS.SENT_BACK]: 'SENT_BACK',
      [NOTIFICATION_EVENTS.FEEDBACK_REQUESTED]: 'FEEDBACK_REQUESTED',
      [NOTIFICATION_EVENTS.STATUS_CHANGED]: 'STATUS_CHANGED',

      // ===================== REMINDERS =====================
      [NOTIFICATION_EVENTS.EVIDENCE_DUE_REMINDER]: 'EVIDENCE_DUE_REMINDER',
      [NOTIFICATION_EVENTS.CAPA_DUE_REMINDER]: 'CAPA_DUE_REMINDER',
      [NOTIFICATION_EVENTS.REVIEW_DUE_REMINDER]: 'REVIEW_DUE_REMINDER',
      [NOTIFICATION_EVENTS.CLARIFICATION_REMINDER]: 'CLARIFICATION_REMINDER',

      // ===================== ESCALATIONS =====================
      [NOTIFICATION_EVENTS.ESCALATE_FIELDWORK_RESPONSE]: 'ESCALATE_FIELDWORK_RESPONSE',
      [NOTIFICATION_EVENTS.ESCALATE_CLARIFICATION]: 'ESCALATE_CLARIFICATION',
      [NOTIFICATION_EVENTS.ESCALATE_ACKNOWLEDGMENT]: 'ESCALATE_ACKNOWLEDGMENT',

      // ===================== TPRM =====================
      [NOTIFICATION_EVENTS.TPRM_ACCOUNT_CREATED]: 'TPRM_ACCOUNT_CREATED',
      [NOTIFICATION_EVENTS.TPRM_VENDOR_ONBOARDED]: 'TPRM_VENDOR_ONBOARDED',
      [NOTIFICATION_EVENTS.TPRM_VENDOR_OFFBOARDING]: 'TPRM_VENDOR_OFFBOARDING',
      [NOTIFICATION_EVENTS.TPRM_VENDOR_TERMINATED]: 'TPRM_VENDOR_TERMINATED',
      [NOTIFICATION_EVENTS.TPRM_ASSESSMENT_INITIATED]: 'TPRM_ASSESSMENT_INITIATED',
      [NOTIFICATION_EVENTS.TPRM_ASSESSMENT_ASSIGNED]: 'TPRM_ASSESSMENT_ASSIGNED',
      [NOTIFICATION_EVENTS.TPRM_ASSESSMENT_SUBMITTED]: 'TPRM_ASSESSMENT_SUBMITTED',
      [NOTIFICATION_EVENTS.TPRM_ASSESSMENT_COMPLETED]: 'TPRM_ASSESSMENT_COMPLETED',
      [NOTIFICATION_EVENTS.TPRM_ASSESSMENT_RETURNED]: 'TPRM_ASSESSMENT_RETURNED',
      [NOTIFICATION_EVENTS.TPRM_ASSESSMENT_REASSIGNED]: 'TPRM_ASSESSMENT_REASSIGNED',
      [NOTIFICATION_EVENTS.TPRM_SME_ASSIGNED]: 'TPRM_SME_ASSIGNED',
      [NOTIFICATION_EVENTS.TPRM_CLARIFICATION_REQUESTED]: 'TPRM_CLARIFICATION_REQUESTED',
      [NOTIFICATION_EVENTS.TPRM_COMMENT_ADDED]: 'TPRM_COMMENT_ADDED',
      [NOTIFICATION_EVENTS.TPRM_OVERRIDE_APPLIED]: 'TPRM_OVERRIDE_APPLIED',
      [NOTIFICATION_EVENTS.TPRM_VENDOR_ISSUE_CREATED]: 'TPRM_VENDOR_ISSUE_CREATED',
      [NOTIFICATION_EVENTS.TPRM_SUPPORT_REQUEST]: 'TPRM_SUPPORT_REQUEST',
      [NOTIFICATION_EVENTS.TPRM_CONTRACT_EXPIRY]: 'TPRM_CONTRACT_EXPIRY',
      [NOTIFICATION_EVENTS.TPRM_RM_ACCOUNT_CREATED]: 'TPRM_RM_ACCOUNT_CREATED',
      [NOTIFICATION_EVENTS.TPRM_ASSESSMENT_SENT_TO_APPROVER]: 'TPRM_ASSESSMENT_SENT_TO_APPROVER',
      [NOTIFICATION_EVENTS.TPRM_ASSESSMENT_APPROVED]: 'TPRM_ASSESSMENT_APPROVED',
      [NOTIFICATION_EVENTS.TPRM_REMEDIATION_CREATED]: 'TPRM_REMEDIATION_CREATED',
      [NOTIFICATION_EVENTS.TPRM_REMEDIATION_SUBMITTED]: 'TPRM_REMEDIATION_SUBMITTED',
      [NOTIFICATION_EVENTS.TPRM_REMEDIATION_SATISFIED]: 'TPRM_REMEDIATION_SATISFIED',
      [NOTIFICATION_EVENTS.TPRM_REMEDIATION_UNSATISFIED]: 'TPRM_REMEDIATION_UNSATISFIED',
      [NOTIFICATION_EVENTS.TPRM_REMEDIATION_SENT_TO_BUSINESS]: 'TPRM_REMEDIATION_SENT_TO_BUSINESS',
      [NOTIFICATION_EVENTS.TPRM_REMEDIATION_ASSIGNED_TO_IT]: 'TPRM_REMEDIATION_ASSIGNED_TO_IT',
      [NOTIFICATION_EVENTS.TPRM_REMEDIATION_IT_SUBMITTED]: 'TPRM_REMEDIATION_IT_SUBMITTED',
      [NOTIFICATION_EVENTS.TPRM_REMEDIATION_IT_APPROVED]: 'TPRM_REMEDIATION_IT_APPROVED',
      [NOTIFICATION_EVENTS.TPRM_REMEDIATION_IT_RETURNED]: 'TPRM_REMEDIATION_IT_RETURNED',
      [NOTIFICATION_EVENTS.TPRM_VENDOR_ISSUE_UPDATED]: 'TPRM_VENDOR_ISSUE_UPDATED',
      [NOTIFICATION_EVENTS.TPRM_VENDOR_ISSUE_RESOLVED]: 'TPRM_VENDOR_ISSUE_RESOLVED',
      [NOTIFICATION_EVENTS.TPRM_OFFBOARD_SUBMITTED]: 'TPRM_OFFBOARD_SUBMITTED',
      [NOTIFICATION_EVENTS.TPRM_OFFBOARD_ASSESSOR_APPROVED]: 'TPRM_OFFBOARD_ASSESSOR_APPROVED',
      [NOTIFICATION_EVENTS.TPRM_OFFBOARD_ASSESSOR_SENT_BACK]: 'TPRM_OFFBOARD_ASSESSOR_SENT_BACK',
      [NOTIFICATION_EVENTS.TPRM_OFFBOARD_RM_APPROVED]: 'TPRM_OFFBOARD_RM_APPROVED',
      [NOTIFICATION_EVENTS.TPRM_OFFBOARD_RM_SENT_BACK]: 'TPRM_OFFBOARD_RM_SENT_BACK',
      [NOTIFICATION_EVENTS.TPRM_OFFBOARD_BO_APPROVED]: 'TPRM_OFFBOARD_BO_APPROVED',
      [NOTIFICATION_EVENTS.TPRM_OFFBOARD_BO_SENT_TO_RM]: 'TPRM_OFFBOARD_BO_SENT_TO_RM',
      [NOTIFICATION_EVENTS.TPRM_MONITORING_SCAN_COMPLETED]: 'TPRM_MONITORING_SCAN_COMPLETED',
      [NOTIFICATION_EVENTS.TPRM_MONITORING_CRITICAL_RISK]: 'TPRM_MONITORING_CRITICAL_RISK',
      [NOTIFICATION_EVENTS.TPRM_CLARIFICATION_RESPONDED]: 'TPRM_CLARIFICATION_RESPONDED',
      [NOTIFICATION_EVENTS.TPRM_REMEDIATION_OVERDUE]: 'TPRM_REMEDIATION_OVERDUE',
      [NOTIFICATION_EVENTS.TPRM_REMEDIATION_ALL_CLOSED]: 'TPRM_REMEDIATION_ALL_CLOSED',
      [NOTIFICATION_EVENTS.TPRM_VENDOR_ISSUE_ESCALATED]: 'TPRM_VENDOR_ISSUE_ESCALATED',
      [NOTIFICATION_EVENTS.TPRM_ASSESSMENT_DUE_REMINDER]: 'TPRM_ASSESSMENT_DUE_REMINDER',
      [NOTIFICATION_EVENTS.TPRM_SME_ASSIGNMENT_PENDING]: 'TPRM_SME_ASSIGNMENT_PENDING',
      [NOTIFICATION_EVENTS.TPRM_CADENCE_REASSESSMENT]: 'TPRM_CADENCE_REASSESSMENT',
      [NOTIFICATION_EVENTS.TPRM_REMEDIATION_DUE_REMINDER]: 'TPRM_REMEDIATION_DUE_REMINDER',

      // ===================== TPRM CONTRACT DELETION =====================
      [NOTIFICATION_EVENTS.TPRM_CONTRACT_DELETION_REQUESTED]: 'TPRM_CONTRACT_DELETION_REQUESTED',
      [NOTIFICATION_EVENTS.TPRM_CONTRACT_DELETION_APPROVED]: 'TPRM_CONTRACT_DELETION_APPROVED',
      [NOTIFICATION_EVENTS.TPRM_CONTRACT_DELETION_REJECTED]: 'TPRM_CONTRACT_DELETION_REJECTED',
      [NOTIFICATION_EVENTS.TPRM_CONTRACT_DELETED_BY_ADMIN]: 'TPRM_CONTRACT_DELETED_BY_ADMIN',

      // ===================== SUPPORT TICKETING =====================
      // Inbox-only events — no email template; fall back to GENERIC if ever emailed.
      [NOTIFICATION_EVENTS.SUPPORT_TICKET_CREATED]: 'GENERIC_NOTIFICATION',
      [NOTIFICATION_EVENTS.SUPPORT_TICKET_ASSIGNED]: 'GENERIC_NOTIFICATION',
      [NOTIFICATION_EVENTS.SUPPORT_TICKET_ESCALATED]: 'GENERIC_NOTIFICATION',
      [NOTIFICATION_EVENTS.SUPPORT_TICKET_COMMENT_ADDED]: 'GENERIC_NOTIFICATION',
      [NOTIFICATION_EVENTS.SUPPORT_TICKET_SLA_WARNING]: 'GENERIC_NOTIFICATION',
      [NOTIFICATION_EVENTS.SUPPORT_TICKET_SLA_BREACHED]: 'GENERIC_NOTIFICATION',
      [NOTIFICATION_EVENTS.SECURITY_PASSWORD_RESET_ABUSE]: 'GENERIC_NOTIFICATION',
    };

    return templateMap[event] || 'GENERIC_NOTIFICATION';
  }

  // ==================== CONVENIENCE METHODS ====================
  // Pre-built methods for common notification scenarios

  /**
   * Notify when evidence is assigned to a user.
   * Rule: Only triggers if assignee is different from the actor.
   */
  async notifyEvidenceAssigned(params: {
    customerAccountId: string;
    actorId: string;
    assigneeId: string;
    evidenceId: string;
    evidenceName: string;
    controlCode?: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.assigneeId,
      event: NOTIFICATION_EVENTS.EVIDENCE_ASSIGNED,
      title: 'Evidence assigned to you',
      message: params.controlCode
        ? `You have been assigned to provide evidence for ${params.controlCode}: ${params.evidenceName}`
        : `You have been assigned to provide evidence: ${params.evidenceName}`,
      relatedEntityType: 'evidence',
      relatedEntityId: params.evidenceId,
      link: `/compliance/evidence/${params.evidenceId}`,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      channels: params.channels,
      metadata: { entityName: params.evidenceName, controlCode: params.controlCode },
    });
  }

  /**
   * Notify when a risk is assigned to a user.
   */
  async notifyRiskAssigned(params: {
    customerAccountId: string;
    actorId: string;
    ownerId: string;
    riskId: string;
    riskCode: string;
    riskName: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.ownerId,
      event: NOTIFICATION_EVENTS.RISK_ASSIGNED,
      title: 'Risk assigned to you',
      message: `Risk ${params.riskCode}: ${params.riskName} has been assigned to you`,
      relatedEntityType: 'risk',
      relatedEntityId: params.riskId,
      link: `/risks/register/${params.riskId}/edit`,
      channels: params.channels,
      metadata: { entityName: params.riskName, riskCode: params.riskCode },
    });
  }

  /**
   * Notify when a control is assigned to a user.
   */
  async notifyControlAssigned(params: {
    customerAccountId: string;
    actorId: string;
    ownerId: string;
    controlId: string;
    controlCode: string;
    controlName: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.ownerId,
      event: NOTIFICATION_EVENTS.CONTROL_ASSIGNED,
      title: 'Control assigned to you',
      message: `Control ${params.controlCode}: ${params.controlName} has been assigned to you`,
      relatedEntityType: 'control',
      relatedEntityId: params.controlId,
      link: `/compliance/control/${params.controlId}`,
      channels: params.channels,
      metadata: { entityName: params.controlName, controlCode: params.controlCode },
    });
  }

  /**
   * Notify when an asset is assigned to a user.
   */
  async notifyAssetAssigned(params: {
    customerAccountId: string;
    actorId: string;
    ownerId: string;
    assetId: string;
    assetCode: string;
    assetName: string;
    role: 'owner' | 'custodian';
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.ownerId,
      event: NOTIFICATION_EVENTS.ASSET_ASSIGNED,
      title: `Asset ${params.role} assignment`,
      message: `You have been assigned as ${params.role} for asset ${params.assetCode}: ${params.assetName}`,
      relatedEntityType: 'asset',
      relatedEntityId: params.assetId,
      link: `/assets/inventory`,
      channels: params.channels,
      metadata: { entityName: params.assetName, assetCode: params.assetCode, role: params.role },
    });
  }

  /**
   * Notify when a CAPA is assigned to a user.
   */
  async notifyCAPAAssigned(params: {
    customerAccountId: string;
    actorId: string;
    assigneeId: string;
    capaId: string;
    capaCode: string;
    capaTitle: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.assigneeId,
      event: NOTIFICATION_EVENTS.CAPA_ASSIGNED,
      title: 'CAPA assigned to you',
      message: `CAPA ${params.capaCode}: ${params.capaTitle} has been assigned to you`,
      relatedEntityType: 'capa',
      relatedEntityId: params.capaId,
      link: `/internal-audit/capa-tracking`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: params.channels,
      metadata: { entityName: params.capaTitle, capaCode: params.capaCode },
    });
  }

  /**
   * Notify when an audit engagement is assigned.
   */
  async notifyEngagementAssigned(params: {
    customerAccountId: string;
    actorId: string;
    assigneeId: string;
    engagementId: string;
    engagementCode: string;
    engagementName: string;
    role: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.assigneeId,
      event: NOTIFICATION_EVENTS.ENGAGEMENT_ASSIGNED,
      title: 'Audit engagement assigned',
      message: `You have been assigned as ${params.role} for engagement ${params.engagementCode}: ${params.engagementName}`,
      relatedEntityType: 'engagement',
      relatedEntityId: params.engagementId,
      link: `/internal-audit/fieldwork/${params.engagementId}`,
      channels: params.channels,
      metadata: { entityName: params.engagementName, engagementCode: params.engagementCode, role: params.role },
    });
  }

  /**
   * Notify when a comment is added (ALL comments trigger notification).
   */
  async notifyCommentAdded(params: {
    customerAccountId: string;
    actorId: string;
    recipientId: string;
    entityType: string;
    entityId: string;
    entityName: string;
    commentPreview: string;
    link: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.recipientId,
      event: NOTIFICATION_EVENTS.COMMENT_ADDED,
      title: 'New comment',
      message: `New comment on ${params.entityType} "${params.entityName}": ${params.commentPreview}`,
      relatedEntityType: params.entityType,
      relatedEntityId: params.entityId,
      link: params.link,
      channels: params.channels,
      metadata: { entityName: params.entityName, commentPreview: params.commentPreview },
    });
  }

  /**
   * Notify when approval is requested.
   */
  async notifyApprovalRequested(params: {
    customerAccountId: string;
    actorId: string;
    approverId: string;
    entityType: string;
    entityId: string;
    entityName: string;
    link: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.approverId,
      event: NOTIFICATION_EVENTS.APPROVAL_REQUESTED,
      title: 'Approval required',
      message: `Your approval is required for ${params.entityType}: ${params.entityName}`,
      relatedEntityType: params.entityType,
      relatedEntityId: params.entityId,
      link: params.link,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: params.channels,
      metadata: { entityName: params.entityName },
    });
  }

  /**
   * Notify when something is approved.
   */
  async notifyApprovalGranted(params: {
    customerAccountId: string;
    actorId: string;
    requesterId: string;
    entityType: string;
    entityId: string;
    entityName: string;
    link: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.requesterId,
      event: NOTIFICATION_EVENTS.APPROVAL_GRANTED,
      title: 'Approved',
      message: `Your ${params.entityType} "${params.entityName}" has been approved`,
      relatedEntityType: params.entityType,
      relatedEntityId: params.entityId,
      link: params.link,
      channels: params.channels,
      metadata: { entityName: params.entityName },
    });
  }

  /**
   * Notify when something is denied/rejected.
   */
  async notifyApprovalDenied(params: {
    customerAccountId: string;
    actorId: string;
    requesterId: string;
    entityType: string;
    entityId: string;
    entityName: string;
    reason?: string;
    link: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.requesterId,
      event: NOTIFICATION_EVENTS.APPROVAL_DENIED,
      title: 'Rejected',
      message: params.reason
        ? `Your ${params.entityType} "${params.entityName}" was rejected: ${params.reason}`
        : `Your ${params.entityType} "${params.entityName}" was rejected`,
      relatedEntityType: params.entityType,
      relatedEntityId: params.entityId,
      link: params.link,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: params.channels,
      metadata: { entityName: params.entityName, reason: params.reason },
    });
  }

  /**
   * Notify when something is sent back for revision.
   */
  async notifySentBack(params: {
    customerAccountId: string;
    actorId: string;
    assigneeId: string;
    entityType: string;
    entityId: string;
    entityName: string;
    reason?: string;
    link: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.assigneeId,
      event: NOTIFICATION_EVENTS.SENT_BACK,
      title: 'Sent back for revision',
      message: params.reason
        ? `${params.entityType} "${params.entityName}" was sent back: ${params.reason}`
        : `${params.entityType} "${params.entityName}" was sent back for revision`,
      relatedEntityType: params.entityType,
      relatedEntityId: params.entityId,
      link: params.link,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: params.channels,
      metadata: { entityName: params.entityName, reason: params.reason },
    });
  }

  /**
   * Notify when feedback is requested from a user.
   * Use cases: Evidence requests, review requests, etc.
   */
  async notifyFeedbackRequested(params: {
    customerAccountId: string;
    actorId: string;
    feedbackProviderId: string;
    entityType: string;
    entityId: string;
    entityName: string;
    description?: string;
    link: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.feedbackProviderId,
      event: NOTIFICATION_EVENTS.FEEDBACK_REQUESTED,
      title: 'Feedback requested',
      message: params.description
        ? `Your feedback is requested for ${params.entityType} "${params.entityName}": ${params.description}`
        : `Your feedback is requested for ${params.entityType} "${params.entityName}"`,
      relatedEntityType: params.entityType,
      relatedEntityId: params.entityId,
      link: params.link,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      channels: params.channels,
      metadata: { entityName: params.entityName },
    });
  }

  /**
   * Notify when clarification is requested for an evidence request.
   * Triggered when aiReviewStatus changes to "Needs Attention".
   */
  async notifyClarificationRequested(params: {
    customerAccountId: string;
    actorId: string;
    auditeeId: string;
    requestId: string;
    requestName: string;
    clarificationComment?: string;
    link: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.auditeeId,
      event: NOTIFICATION_EVENTS.FEEDBACK_REQUESTED,
      title: 'Feedback requested',
      message: params.clarificationComment
        ? `Clarification requested for Evidence Request "${params.requestName}": ${params.clarificationComment}`
        : `Clarification requested for Evidence Request "${params.requestName}"`,
      relatedEntityType: 'Evidence Request',
      relatedEntityId: params.requestId,
      link: params.link,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      channels: params.channels,
      metadata: { entityName: params.requestName },
    });
  }

  /**
   * Send due date reminder (system-triggered).
   * Note: actorId should be 'system' or the system user ID.
   */
  async notifyDueReminder(params: {
    customerAccountId: string;
    recipientId: string;
    entityType: 'evidence' | 'capa' | 'review';
    entityId: string;
    entityName: string;
    dueDate: Date;
    link: string;
    channels?: NotificationChannel[];
  }) {
    const eventMap = {
      evidence: NOTIFICATION_EVENTS.EVIDENCE_DUE_REMINDER,
      capa: NOTIFICATION_EVENTS.CAPA_DUE_REMINDER,
      review: NOTIFICATION_EVENTS.REVIEW_DUE_REMINDER,
    };

    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: 'system', // System-triggered, not a user action
      recipientId: params.recipientId,
      event: eventMap[params.entityType],
      title: `${params.entityType.charAt(0).toUpperCase() + params.entityType.slice(1)} due soon`,
      message: `${params.entityName} is due on ${params.dueDate.toLocaleDateString()}`,
      relatedEntityType: params.entityType,
      relatedEntityId: params.entityId,
      link: params.link,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: params.channels,
      metadata: { entityName: params.entityName, dueDate: params.dueDate.toLocaleDateString() },
    });
  }

  /**
   * Notify new user about account creation.
   */
  async notifyUserCreated(params: {
    customerAccountId: string;
    actorId: string;
    newUserId: string;
    userName: string;
    /**
     * Modules the new user has a role in. A separate welcome is created per
     * module, each scoped to that workspace so it only appears once the user
     * enters that platform. Falls back to a single generic welcome when
     * omitted/empty (e.g. legacy callers).
     */
    modules?: ModuleCode[];
    channels?: NotificationChannel[];
  }) {
    const moduleList = (params.modules ?? []).filter(
      (m, i, arr) => arr.indexOf(m) === i, // de-dupe
    );

    // No resolvable modules — keep the legacy single, workspace-agnostic welcome.
    if (moduleList.length === 0) {
      return this.send({
        customerAccountId: params.customerAccountId,
        actorId: params.actorId,
        recipientId: params.newUserId,
        event: NOTIFICATION_EVENTS.USER_CREATED,
        title: 'Welcome',
        message: `Welcome ${params.userName}! Your account has been created successfully.`,
        link: '/dashboard',
        channels: params.channels,
        metadata: { userName: params.userName },
      });
    }

    // One welcome per platform the user belongs to.
    let last: Awaited<ReturnType<NotificationService['send']>> | undefined;
    for (const m of moduleList) {
      last = await this.send({
        customerAccountId: params.customerAccountId,
        actorId: params.actorId,
        recipientId: params.newUserId,
        event: NOTIFICATION_EVENTS.USER_CREATED,
        title: `Welcome to ${MODULE_LABELS[m]}`,
        message: `Welcome ${params.userName}! Your ${MODULE_LABELS[m]} account has been created successfully.`,
        module: m,
        link: getModuleHome(m),
        channels: params.channels,
        metadata: { userName: params.userName, module: m },
      });
    }
    return last!;
  }

  /**
   * Notify when an issue is created from AI evidence review.
   * Triggered when AI identifies non-compliance during evidence review.
   */
  async notifyIssueCreatedFromEvidence(params: {
    customerAccountId: string;
    actorId: string;
    assigneeId: string;
    evidenceId: string;
    evidenceName: string;
    issueId?: string;
    link: string;
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.assigneeId,
      event: NOTIFICATION_EVENTS.ISSUE_EVIDENCE,
      title: 'Issue created from evidence review',
      message: `Evidence "${params.evidenceName}" review generated an issue that has been assigned to you`,
      relatedEntityType: 'evidence',
      relatedEntityId: params.evidenceId,
      link: params.link,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      metadata: {
        issueId: params.issueId,
        evidenceName: params.evidenceName,
        entityName: params.evidenceName,
      },
    });
  }

  /**
   * Send system announcement to all users in a customer account.
   */
  async sendAnnouncement(params: {
    customerAccountId: string;
    actorId: string;
    title: string;
    message: string;
  }) {
    try {
      const users = await prisma.user.findMany({
        where: {
          customerAccountId: params.customerAccountId,
          isActive: true,
        },
        select: { id: true },
      });

      if (users.length === 0) {
        return { success: true, count: 0 };
      }

      return this.sendBulk({
        customerAccountId: params.customerAccountId,
        actorId: params.actorId,
        recipientIds: users.map(u => u.id),
        event: NOTIFICATION_EVENTS.SYSTEM_ANNOUNCEMENT,
        title: params.title,
        message: params.message,
      });
    } catch (error) {
      console.error('[NotificationService] Error sending announcement:', error);
      return { success: false, count: 0 };
    }
  }

  // ==================== TPRM CONVENIENCE METHODS ====================

  /**
   * Notify when a TPRM user account is created.
   */
  async notifyTPRMAccountCreated(params: {
    customerAccountId: string;
    actorId: string;
    newUserId: string;
    userName: string;
    tprmRole: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.newUserId,
      event: NOTIFICATION_EVENTS.TPRM_ACCOUNT_CREATED,
      title: 'TPRM account created',
      message: `Your TPRM account has been created with role: ${params.tprmRole}.`,
      module: 'TPRM',
      channels: params.channels,
      metadata: { userName: params.userName, tprmRole: params.tprmRole },
    });
  }

  /**
   * Notify admins/BO when a Relationship Manager account is created.
   */
  async notifyTPRMRMAccountCreated(params: {
    customerAccountId: string;
    actorId: string;
    recipientIds: string[];
    rmName: string;
    rmEmail: string;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_RM_ACCOUNT_CREATED,
      title: 'Relationship Manager account created',
      message: `A new Relationship Manager account has been created for ${params.rmName} (${params.rmEmail}).`,
      module: 'TPRM',
      channels: params.channels,
      metadata: { rmName: params.rmName, rmEmail: params.rmEmail },
    });
  }

  /**
   * Notify when a vendor is onboarded (created).
   * Notifies the account manager for the vendor.
   */
  async notifyTPRMVendorOnboarded(params: {
    customerAccountId: string;
    actorId: string;
    recipientId: string;
    vendorId: string;
    vendorName: string;
    vendorCode: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.recipientId,
      event: NOTIFICATION_EVENTS.TPRM_VENDOR_ONBOARDED,
      title: 'Vendor access provisioned',
      message: `Vendor ${params.vendorCode}: ${params.vendorName} has been onboarded.`,
      relatedEntityType: 'vendor',
      relatedEntityId: params.vendorId,
      link: `/tprm/bo-inventory`,
      channels: params.channels,
      metadata: { entityName: params.vendorName, vendorCode: params.vendorCode },
    });
  }

  /**
   * Notify when vendor offboarding is initiated.
   */
  async notifyTPRMVendorOffboarding(params: {
    customerAccountId: string;
    actorId: string;
    recipientId: string;
    vendorId: string;
    vendorName: string;
    vendorCode: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.recipientId,
      event: NOTIFICATION_EVENTS.TPRM_VENDOR_OFFBOARDING,
      title: 'Vendor offboarding initiated',
      message: `Vendor offboarding process has started for ${params.vendorCode}: ${params.vendorName}.`,
      relatedEntityType: 'vendor',
      relatedEntityId: params.vendorId,
      link: `/tprm/bo-inventory`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: params.channels,
      metadata: { entityName: params.vendorName, vendorCode: params.vendorCode },
    });
  }

  /**
   * Notify internal users when a vendor is terminated, AND send email to the vendor contact.
   */
  async notifyTPRMVendorTerminated(params: {
    customerAccountId: string;
    actorId: string;
    recipientIds: string[];
    vendorId: string;
    vendorName: string;
    vendorCode: string;
    vendorContactEmail?: string | null;
    reason?: string;
    channels?: NotificationChannel[];
  }) {
    // 1. Send in-app + email notifications to internal users (AM, BO, Assessor, etc.)
    for (const recipientId of params.recipientIds) {
      await this.send({
        customerAccountId: params.customerAccountId,
        actorId: params.actorId,
        recipientId,
        event: NOTIFICATION_EVENTS.TPRM_VENDOR_TERMINATED,
        title: 'Vendor terminated',
        message: `Vendor ${params.vendorCode}: ${params.vendorName} has been terminated.${params.reason ? ` Reason: ${params.reason}` : ''}`,
        relatedEntityType: 'vendor',
        relatedEntityId: params.vendorId,
        link: `/tprm/bo-inventory`,
        priority: NOTIFICATION_PRIORITIES.URGENT,
        channels: params.channels,
        metadata: {
          entityName: params.vendorName,
          vendorCode: params.vendorCode,
          reason: params.reason,
        },
      });
    }

    // 2. Send email directly to the vendor's contact email
    if (params.vendorContactEmail) {
      try {
        await sendTemplatedEmail(
          'TPRM_VENDOR_TERMINATED_EXTERNAL',
          params.vendorContactEmail,
          {
            vendorName: params.vendorName,
            vendorCode: params.vendorCode,
            reason: params.reason || 'No reason provided',
            entityLink: getAppUrl(),
          },
          params.vendorName,
        );
        console.log(`[NotificationService] Vendor termination email sent to vendor contact: ${params.vendorContactEmail}`);
      } catch (error) {
        console.error('[NotificationService] Failed to send vendor termination email to vendor:', error);
      }
    }
  }

  /**
   * Notify when a TPRM assessment is initiated.
   * Notifies the account manager that a new assessment is created for their vendor.
   */
  async notifyTPRMAssessmentInitiated(params: {
    customerAccountId: string;
    actorId: string;
    recipientId: string;
    assessmentId: string;
    assessmentCode: string;
    vendorName: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.recipientId,
      event: NOTIFICATION_EVENTS.TPRM_ASSESSMENT_INITIATED,
      title: 'Assessment initiated',
      message: `A new assessment ${params.assessmentCode} has been initiated for vendor ${params.vendorName}.`,
      relatedEntityType: 'assessment',
      relatedEntityId: params.assessmentId,
      link: `/tprm/am-assessments/${params.assessmentId}`,
      channels: params.channels,
      metadata: { entityName: params.assessmentCode, vendorName: params.vendorName },
    });
  }

  /**
   * Notify when an assessment is assigned to an assessor.
   */
  async notifyTPRMAssessmentAssigned(params: {
    customerAccountId: string;
    actorId: string;
    assessorId: string;
    assessmentId: string;
    assessmentCode: string;
    vendorName: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.assessorId,
      event: NOTIFICATION_EVENTS.TPRM_ASSESSMENT_ASSIGNED,
      title: 'Assessment assigned to you',
      message: `Assessment ${params.assessmentCode} for vendor ${params.vendorName} has been assigned to you.`,
      relatedEntityType: 'assessment',
      relatedEntityId: params.assessmentId,
      link: `/tprm/asr-assessments/${params.assessmentId}`,
      channels: params.channels,
      metadata: { entityName: params.assessmentCode, vendorName: params.vendorName },
    });
  }

  /**
   * Notify when an assessment is submitted by AM/vendor.
   * Notifies the assigned assessor.
   */
  async notifyTPRMAssessmentSubmitted(params: {
    customerAccountId: string;
    actorId: string;
    recipientId: string;
    assessmentId: string;
    assessmentCode: string;
    vendorName: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.recipientId,
      event: NOTIFICATION_EVENTS.TPRM_ASSESSMENT_SUBMITTED,
      title: 'Assessment submitted for review',
      message: `Assessment ${params.assessmentCode} for vendor ${params.vendorName} has been submitted for your review.`,
      relatedEntityType: 'assessment',
      relatedEntityId: params.assessmentId,
      link: `/tprm/asr-assessments/${params.assessmentId}`,
      channels: params.channels,
      metadata: { entityName: params.assessmentCode, vendorName: params.vendorName },
    });
  }

  /**
   * Notify when an assessment is completed/reviewed by assessor.
   * Notifies the initiator/account manager.
   */
  async notifyTPRMAssessmentCompleted(params: {
    customerAccountId: string;
    actorId: string;
    recipientId: string;
    assessmentId: string;
    assessmentCode: string;
    vendorName: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.recipientId,
      event: NOTIFICATION_EVENTS.TPRM_ASSESSMENT_COMPLETED,
      title: 'Assessment reviewed',
      message: `Assessment ${params.assessmentCode} for vendor ${params.vendorName} has been reviewed.`,
      relatedEntityType: 'assessment',
      relatedEntityId: params.assessmentId,
      link: `/tprm/am-assessments/${params.assessmentId}`,
      channels: params.channels,
      metadata: { entityName: params.assessmentCode, vendorName: params.vendorName },
    });
  }

  /**
   * Notify when an assessment is returned/rejected by assessor.
   * Notifies the account manager.
   */
  async notifyTPRMAssessmentReturned(params: {
    customerAccountId: string;
    actorId: string;
    recipientId: string;
    assessmentId: string;
    assessmentCode: string;
    vendorName: string;
    comment?: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.recipientId,
      event: NOTIFICATION_EVENTS.TPRM_ASSESSMENT_RETURNED,
      title: 'Assessment returned',
      message: params.comment
        ? `Assessment ${params.assessmentCode} for vendor ${params.vendorName} has been returned: ${params.comment}`
        : `Assessment ${params.assessmentCode} for vendor ${params.vendorName} has been returned. Please review comments.`,
      relatedEntityType: 'assessment',
      relatedEntityId: params.assessmentId,
      link: `/tprm/am-assessments/${params.assessmentId}`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: params.channels,
      metadata: { entityName: params.assessmentCode, vendorName: params.vendorName, reason: params.comment },
    });
  }

  /**
   * Notify when an assessment is returned to the assessor by the approver.
   * Notifies the assessor with an assessor-side link.
   */
  async notifyTPRMAssessmentReturnedToAssessor(params: {
    customerAccountId: string;
    actorId: string;
    recipientId: string;
    assessmentId: string;
    assessmentCode: string;
    vendorName: string;
    comment?: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.recipientId,
      event: NOTIFICATION_EVENTS.TPRM_ASSESSMENT_RETURNED,
      title: 'Assessment returned to you',
      message: params.comment
        ? `Assessment ${params.assessmentCode} for vendor ${params.vendorName} has been returned by the approver: ${params.comment}`
        : `Assessment ${params.assessmentCode} for vendor ${params.vendorName} has been returned by the approver. Please review comments.`,
      relatedEntityType: 'assessment',
      relatedEntityId: params.assessmentId,
      link: `/tprm/asr-assessments/${params.assessmentId}`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: params.channels,
      metadata: { entityName: params.assessmentCode, vendorName: params.vendorName, reason: params.comment },
    });
  }

  /**
   * Notify when a clarification is requested on an assessment.
   * Notifies the account manager/vendor.
   */
  async notifyTPRMClarificationRequested(params: {
    customerAccountId: string;
    actorId: string;
    recipientId: string;
    assessmentId: string;
    assessmentCode: string;
    vendorName: string;
    comment?: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.recipientId,
      event: NOTIFICATION_EVENTS.TPRM_CLARIFICATION_REQUESTED,
      title: 'Clarification requested',
      message: params.comment
        ? `Assessor has requested clarification on assessment ${params.assessmentCode}: ${params.comment}`
        : `Assessor has requested clarification on assessment ${params.assessmentCode} for vendor ${params.vendorName}.`,
      relatedEntityType: 'assessment',
      relatedEntityId: params.assessmentId,
      link: `/tprm/am-assessments/${params.assessmentId}`,
      channels: params.channels,
      metadata: { entityName: params.assessmentCode, vendorName: params.vendorName },
    });
  }

  /**
   * Notify when a comment is added on a TPRM assessment.
   */
  async notifyTPRMCommentAdded(params: {
    customerAccountId: string;
    actorId: string;
    recipientId: string;
    assessmentId: string;
    assessmentCode: string;
    commentPreview: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.recipientId,
      event: NOTIFICATION_EVENTS.TPRM_COMMENT_ADDED,
      title: 'New comment on assessment',
      message: `New comment on assessment ${params.assessmentCode}: ${params.commentPreview}`,
      relatedEntityType: 'assessment',
      relatedEntityId: params.assessmentId,
      link: `/tprm/asr-assessments/${params.assessmentId}`,
      channels: params.channels,
      metadata: { entityName: params.assessmentCode, commentPreview: params.commentPreview },
    });
  }

  /**
   * Notify when a vendor issue is created.
   */
  async notifyTPRMVendorIssueCreated(params: {
    customerAccountId: string;
    actorId: string;
    recipientIds: string[];
    issueId: string;
    issueTitle: string;
    vendorName: string;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_VENDOR_ISSUE_CREATED,
      title: 'Vendor issue reported',
      message: `A new issue has been reported for vendor ${params.vendorName}: ${params.issueTitle}`,
      relatedEntityType: 'vendor-issue',
      relatedEntityId: params.issueId,
      link: `/tprm/am-follow-ups`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: params.channels,
      metadata: { entityName: params.issueTitle, vendorName: params.vendorName },
    });
  }

  // ==================== TPRM ASSESSMENT APPROVAL ====================

  /**
   * Notify approver when assessment is sent for approval.
   */
  async notifyTPRMAssessmentSentToApprover(params: {
    customerAccountId: string;
    actorId: string;
    approverId: string;
    assessmentId: string;
    assessmentCode: string;
    vendorName: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.approverId,
      event: NOTIFICATION_EVENTS.TPRM_ASSESSMENT_SENT_TO_APPROVER,
      title: 'Assessment awaiting your approval',
      message: `Assessment ${params.assessmentCode} for vendor ${params.vendorName} is ready for your approval.`,
      relatedEntityType: 'assessment',
      relatedEntityId: params.assessmentId,
      link: `/tprm/asr-assessments/${params.assessmentId}`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: params.channels,
      metadata: { entityName: params.assessmentCode, vendorName: params.vendorName },
    });
  }

  /**
   * Notify when assessment is approved by approver.
   */
  async notifyTPRMAssessmentApproved(params: {
    customerAccountId: string;
    actorId: string;
    recipientIds: string[];
    assessmentId: string;
    assessmentCode: string;
    vendorName: string;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_ASSESSMENT_APPROVED,
      title: 'Assessment approved',
      message: `Assessment ${params.assessmentCode} for vendor ${params.vendorName} has been approved.`,
      relatedEntityType: 'assessment',
      relatedEntityId: params.assessmentId,
      link: `/tprm/am-assessments/${params.assessmentId}`,
      channels: params.channels,
      metadata: { entityName: params.assessmentCode, vendorName: params.vendorName },
    });
  }

  // ==================== TPRM REMEDIATION WORKFLOW ====================

  /**
   * Notify when remediation items are auto-created after assessment approval.
   */
  async notifyTPRMRemediationCreated(params: {
    customerAccountId: string;
    actorId: string;
    recipientIds: string[];
    assessmentId: string;
    assessmentCode: string;
    vendorName: string;
    count: number;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_REMEDIATION_CREATED,
      title: 'Remediation items created',
      message: `${params.count} remediation item(s) have been created for assessment ${params.assessmentCode} (vendor: ${params.vendorName}).`,
      relatedEntityType: 'remediation',
      relatedEntityId: params.assessmentId,
      link: `/tprm/am-follow-ups`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: params.channels,
      metadata: { entityName: params.assessmentCode, vendorName: params.vendorName, count: params.count },
    });
  }

  /**
   * Notify when AM submits remediation response.
   */
  async notifyTPRMRemediationSubmitted(params: {
    customerAccountId: string;
    actorId: string;
    recipientIds: string[];
    remediationId: string;
    issueCode: string;
    vendorName: string;
    questionTitle: string;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_REMEDIATION_SUBMITTED,
      title: 'Remediation response submitted',
      message: `Remediation response submitted for ${params.vendorName}: ${params.questionTitle || params.issueCode}.`,
      relatedEntityType: 'remediation',
      relatedEntityId: params.remediationId,
      link: `/tprm/asr-follow-ups`,
      channels: params.channels,
      metadata: { entityName: params.issueCode, vendorName: params.vendorName, questionTitle: params.questionTitle },
    });
  }

  /**
   * Notify when remediation is marked satisfactory.
   */
  async notifyTPRMRemediationSatisfied(params: {
    customerAccountId: string;
    actorId: string;
    recipientIds: string[];
    remediationId: string;
    issueCode: string;
    vendorName: string;
    questionTitle: string;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_REMEDIATION_SATISFIED,
      title: 'Remediation marked satisfactory',
      message: `Remediation for ${params.vendorName} - ${params.questionTitle || params.issueCode} has been marked as Satisfactory.`,
      relatedEntityType: 'remediation',
      relatedEntityId: params.remediationId,
      link: `/tprm/am-follow-ups`,
      channels: params.channels,
      metadata: { entityName: params.issueCode, vendorName: params.vendorName, questionTitle: params.questionTitle },
    });
  }

  /**
   * Notify when remediation is marked unsatisfactory.
   */
  async notifyTPRMRemediationUnsatisfied(params: {
    customerAccountId: string;
    actorId: string;
    recipientIds: string[];
    remediationId: string;
    issueCode: string;
    vendorName: string;
    questionTitle: string;
    reason?: string;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_REMEDIATION_UNSATISFIED,
      title: 'Remediation marked unsatisfactory',
      message: params.reason
        ? `Remediation for ${params.vendorName} - ${params.questionTitle || params.issueCode} marked Unsatisfactory: ${params.reason}`
        : `Remediation for ${params.vendorName} - ${params.questionTitle || params.issueCode} marked Unsatisfactory. Further action required.`,
      relatedEntityType: 'remediation',
      relatedEntityId: params.remediationId,
      link: `/tprm/am-follow-ups`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: params.channels,
      metadata: { entityName: params.issueCode, vendorName: params.vendorName, questionTitle: params.questionTitle, reason: params.reason },
    });
  }

  /**
   * Notify when remediation is sent to business (RM).
   */
  async notifyTPRMRemediationSentToBusiness(params: {
    customerAccountId: string;
    actorId: string;
    recipientId: string;
    remediationId: string;
    issueCode: string;
    vendorName: string;
    questionTitle: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.recipientId,
      event: NOTIFICATION_EVENTS.TPRM_REMEDIATION_SENT_TO_BUSINESS,
      title: 'Remediation assigned to you',
      message: `Remediation for ${params.vendorName} - ${params.questionTitle || params.issueCode} has been sent to you for business review.`,
      relatedEntityType: 'remediation',
      relatedEntityId: params.remediationId,
      link: `/tprm/rm-issues`,
      channels: params.channels,
      metadata: { entityName: params.issueCode, vendorName: params.vendorName, questionTitle: params.questionTitle },
    });
  }

  /**
   * Notify when remediation is assigned to IT.
   */
  async notifyTPRMRemediationAssignedToIT(params: {
    customerAccountId: string;
    actorId: string;
    recipientId: string;
    remediationId: string;
    issueCode: string;
    vendorName: string;
    questionTitle: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.recipientId,
      event: NOTIFICATION_EVENTS.TPRM_REMEDIATION_ASSIGNED_TO_IT,
      title: 'Remediation assigned to you',
      message: `Remediation for ${params.vendorName} - ${params.questionTitle || params.issueCode} has been assigned to you for IT review.`,
      relatedEntityType: 'remediation',
      relatedEntityId: params.remediationId,
      link: `/tprm/it-issues`,
      channels: params.channels,
      metadata: { entityName: params.issueCode, vendorName: params.vendorName, questionTitle: params.questionTitle },
    });
  }

  /**
   * Notify when IT/RM submits remediation response.
   */
  async notifyTPRMRemediationITSubmitted(params: {
    customerAccountId: string;
    actorId: string;
    recipientIds: string[];
    remediationId: string;
    issueCode: string;
    vendorName: string;
    questionTitle: string;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_REMEDIATION_IT_SUBMITTED,
      title: 'IT remediation response submitted',
      message: `IT/RM has submitted remediation response for ${params.vendorName}: ${params.questionTitle || params.issueCode}.`,
      relatedEntityType: 'remediation',
      relatedEntityId: params.remediationId,
      link: `/tprm/asr-follow-ups`,
      channels: params.channels,
      metadata: { entityName: params.issueCode, vendorName: params.vendorName, questionTitle: params.questionTitle },
    });
  }

  /**
   * Notify when IT remediation is approved.
   */
  async notifyTPRMRemediationITApproved(params: {
    customerAccountId: string;
    actorId: string;
    recipientId: string;
    remediationId: string;
    issueCode: string;
    vendorName: string;
    questionTitle: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.recipientId,
      event: NOTIFICATION_EVENTS.TPRM_REMEDIATION_IT_APPROVED,
      title: 'IT remediation approved',
      message: `IT remediation for ${params.vendorName} - ${params.questionTitle || params.issueCode} has been approved.`,
      relatedEntityType: 'remediation',
      relatedEntityId: params.remediationId,
      link: `/tprm/it-issues`,
      channels: params.channels,
      metadata: { entityName: params.issueCode, vendorName: params.vendorName, questionTitle: params.questionTitle },
    });
  }

  /**
   * Notify when IT remediation is returned.
   */
  async notifyTPRMRemediationITReturned(params: {
    customerAccountId: string;
    actorId: string;
    recipientId: string;
    remediationId: string;
    issueCode: string;
    vendorName: string;
    questionTitle: string;
    reason?: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.recipientId,
      event: NOTIFICATION_EVENTS.TPRM_REMEDIATION_IT_RETURNED,
      title: 'IT remediation returned',
      message: params.reason
        ? `IT remediation for ${params.vendorName} - ${params.questionTitle || params.issueCode} returned: ${params.reason}`
        : `IT remediation for ${params.vendorName} - ${params.questionTitle || params.issueCode} returned. Please revise.`,
      relatedEntityType: 'remediation',
      relatedEntityId: params.remediationId,
      link: `/tprm/it-issues`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: params.channels,
      metadata: { entityName: params.issueCode, vendorName: params.vendorName, questionTitle: params.questionTitle, reason: params.reason },
    });
  }

  // ==================== TPRM VENDOR ISSUES ====================

  /**
   * Notify when a vendor issue is updated.
   */
  async notifyTPRMVendorIssueUpdated(params: {
    customerAccountId: string;
    actorId: string;
    recipientIds: string[];
    issueId: string;
    issueTitle: string;
    vendorName: string;
    newStatus: string;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_VENDOR_ISSUE_UPDATED,
      title: 'Vendor issue updated',
      message: `Vendor issue for ${params.vendorName} has been updated: ${params.issueTitle}. Status: ${params.newStatus}.`,
      relatedEntityType: 'vendor-issue',
      relatedEntityId: params.issueId,
      link: `/tprm/am-follow-ups`,
      channels: params.channels,
      metadata: { entityName: params.issueTitle, vendorName: params.vendorName, newStatus: params.newStatus },
    });
  }

  /**
   * Notify when a vendor issue is resolved.
   */
  async notifyTPRMVendorIssueResolved(params: {
    customerAccountId: string;
    actorId: string;
    recipientIds: string[];
    issueId: string;
    issueTitle: string;
    vendorName: string;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_VENDOR_ISSUE_RESOLVED,
      title: 'Vendor issue resolved',
      message: `Vendor issue for ${params.vendorName} has been resolved: ${params.issueTitle}.`,
      relatedEntityType: 'vendor-issue',
      relatedEntityId: params.issueId,
      link: `/tprm/am-follow-ups`,
      channels: params.channels,
      metadata: { entityName: params.issueTitle, vendorName: params.vendorName },
    });
  }

  // ==================== TPRM OFFBOARDING WORKFLOW ====================

  /**
   * Generic offboarding notification helper.
   */
  private async notifyTPRMOffboard(params: {
    customerAccountId: string;
    actorId: string;
    recipientIds: string[];
    assessmentId: string;
    assessmentCode: string;
    vendorName: string;
    event: NotificationEvent;
    title: string;
    message: string;
    priority?: NotificationPriority;
    comment?: string;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientIds: params.recipientIds,
      event: params.event,
      title: params.title,
      message: params.message,
      relatedEntityType: 'offboard-assessment',
      relatedEntityId: params.assessmentId,
      link: `/tprm/offboard-review/${params.assessmentId}`,
      priority: params.priority || NOTIFICATION_PRIORITIES.NORMAL,
      channels: params.channels,
      metadata: { entityName: params.assessmentCode, vendorName: params.vendorName, reason: params.comment },
    });
  }

  async notifyTPRMOffboardSubmitted(params: {
    customerAccountId: string; actorId: string; recipientIds: string[];
    assessmentId: string; assessmentCode: string; vendorName: string;
  }) {
    return this.notifyTPRMOffboard({
      ...params,
      event: NOTIFICATION_EVENTS.TPRM_OFFBOARD_SUBMITTED,
      title: 'Offboard assessment submitted',
      message: `Offboard assessment for vendor ${params.vendorName} has been submitted for your review.`,
    });
  }

  async notifyTPRMOffboardAssessorApproved(params: {
    customerAccountId: string; actorId: string; recipientIds: string[];
    assessmentId: string; assessmentCode: string; vendorName: string;
  }) {
    return this.notifyTPRMOffboard({
      ...params,
      event: NOTIFICATION_EVENTS.TPRM_OFFBOARD_ASSESSOR_APPROVED,
      title: 'Offboard assessment: assessor approved',
      message: `Offboard assessment for vendor ${params.vendorName} has been approved by assessor. Awaiting RM review.`,
    });
  }

  async notifyTPRMOffboardAssessorSentBack(params: {
    customerAccountId: string; actorId: string; recipientIds: string[];
    assessmentId: string; assessmentCode: string; vendorName: string; comment?: string;
  }) {
    return this.notifyTPRMOffboard({
      ...params,
      event: NOTIFICATION_EVENTS.TPRM_OFFBOARD_ASSESSOR_SENT_BACK,
      title: 'Offboard assessment returned by assessor',
      message: params.comment
        ? `Offboard assessment for vendor ${params.vendorName} returned by assessor: ${params.comment}`
        : `Offboard assessment for vendor ${params.vendorName} has been returned by assessor for rework.`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
    });
  }

  async notifyTPRMOffboardRMApproved(params: {
    customerAccountId: string; actorId: string; recipientIds: string[];
    assessmentId: string; assessmentCode: string; vendorName: string;
  }) {
    return this.notifyTPRMOffboard({
      ...params,
      event: NOTIFICATION_EVENTS.TPRM_OFFBOARD_RM_APPROVED,
      title: 'Offboard assessment: RM approved',
      message: `Offboard assessment for vendor ${params.vendorName} has been approved by RM. Awaiting Business Owner approval.`,
    });
  }

  async notifyTPRMOffboardRMSentBack(params: {
    customerAccountId: string; actorId: string; recipientIds: string[];
    assessmentId: string; assessmentCode: string; vendorName: string; comment?: string;
  }) {
    return this.notifyTPRMOffboard({
      ...params,
      event: NOTIFICATION_EVENTS.TPRM_OFFBOARD_RM_SENT_BACK,
      title: 'Offboard assessment returned by RM',
      message: params.comment
        ? `Offboard assessment for vendor ${params.vendorName} returned by RM: ${params.comment}`
        : `Offboard assessment for vendor ${params.vendorName} has been returned by RM.`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
    });
  }

  async notifyTPRMOffboardBOApproved(params: {
    customerAccountId: string; actorId: string; recipientIds: string[];
    assessmentId: string; assessmentCode: string; vendorName: string;
  }) {
    return this.notifyTPRMOffboard({
      ...params,
      event: NOTIFICATION_EVENTS.TPRM_OFFBOARD_BO_APPROVED,
      title: 'Vendor offboarding approved',
      message: `Vendor ${params.vendorName} offboarding has been fully approved. Vendor status set to Offboarded.`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
    });
  }

  async notifyTPRMOffboardBOSentToRM(params: {
    customerAccountId: string; actorId: string; recipientIds: string[];
    assessmentId: string; assessmentCode: string; vendorName: string; comment?: string;
  }) {
    return this.notifyTPRMOffboard({
      ...params,
      event: NOTIFICATION_EVENTS.TPRM_OFFBOARD_BO_SENT_TO_RM,
      title: 'Offboard assessment sent back by BO',
      message: params.comment
        ? `Offboard assessment for vendor ${params.vendorName} sent back by Business Owner: ${params.comment}`
        : `Offboard assessment for vendor ${params.vendorName} has been sent back to RM by Business Owner.`,
    });
  }

  // ==================== TPRM CLARIFICATION RESPONSE ====================

  /**
   * Notify when AM responds to a clarification request.
   * Notifies the assessor who requested the clarification.
   */
  async notifyTPRMClarificationResponded(params: {
    customerAccountId: string;
    actorId: string;
    recipientId: string;
    assessmentId: string;
    assessmentCode: string;
    vendorName: string;
    questionNo?: string | null;
    channels?: NotificationChannel[];
  }) {
    // Deep-link to the specific question when known, so the assessor lands
    // directly on the row the AM just responded to instead of the summary.
    const link = params.questionNo
      ? `/tprm/asr-assessments/${params.assessmentId}?questionNo=${encodeURIComponent(params.questionNo)}`
      : `/tprm/asr-assessments/${params.assessmentId}`;
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.recipientId,
      event: NOTIFICATION_EVENTS.TPRM_CLARIFICATION_RESPONDED,
      title: 'Clarification response received',
      message: `Account Manager has responded to your clarification on assessment ${params.assessmentCode} for vendor ${params.vendorName}.`,
      relatedEntityType: 'assessment',
      relatedEntityId: params.assessmentId,
      link,
      channels: params.channels,
      metadata: { entityName: params.assessmentCode, vendorName: params.vendorName },
    });
  }

  // ==================== TPRM MONITORING NOTIFICATIONS ====================

  /**
   * Notify when a vendor monitoring scan completes.
   */
  async notifyTPRMMonitoringScanCompleted(params: {
    customerAccountId: string;
    actorId: string;
    recipientIds: string[];
    vendorName: string;
    riskScore?: number;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_MONITORING_SCAN_COMPLETED,
      title: 'Monitoring scan completed',
      message: params.riskScore != null
        ? `Monitoring scan completed for vendor ${params.vendorName}. Risk score: ${params.riskScore}.`
        : `Monitoring scan completed for vendor ${params.vendorName}.`,
      link: `/tprm/bo-monitoring`,
      channels: params.channels,
      metadata: { vendorName: params.vendorName, riskScore: params.riskScore },
    });
  }

  /**
   * Notify when a critical risk is detected during monitoring scan.
   */
  async notifyTPRMMonitoringCriticalRisk(params: {
    customerAccountId: string;
    actorId: string;
    recipientIds: string[];
    vendorName: string;
    riskScore: number;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_MONITORING_CRITICAL_RISK,
      title: 'Critical risk detected',
      message: `CRITICAL: Monitoring scan for vendor ${params.vendorName} detected high risk. Score: ${params.riskScore}.`,
      link: `/tprm/bo-monitoring`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: params.channels,
      metadata: { vendorName: params.vendorName, riskScore: params.riskScore },
    });
  }

  // ==================== TPRM REMEDIATION LIFECYCLE ====================

  /**
   * Notify when remediation is overdue.
   */
  async notifyTPRMRemediationOverdue(params: {
    customerAccountId: string;
    recipientIds: string[];
    remediationId: string;
    issueCode: string;
    vendorName: string;
    questionTitle: string;
    dueDate: string;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: 'system',
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_REMEDIATION_OVERDUE,
      title: 'Remediation overdue',
      message: `Remediation for ${params.vendorName} - ${params.questionTitle || params.issueCode} is overdue. Due date: ${params.dueDate}.`,
      relatedEntityType: 'remediation',
      relatedEntityId: params.remediationId,
      link: `/tprm/asr-follow-ups`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: params.channels,
      metadata: { entityName: params.issueCode, vendorName: params.vendorName, dueDate: params.dueDate },
    });
  }

  /**
   * Notify when all remediation items for an assessment are closed.
   */
  async notifyTPRMRemediationAllClosed(params: {
    customerAccountId: string;
    actorId: string;
    recipientIds: string[];
    assessmentId: string;
    assessmentCode: string;
    vendorName: string;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_REMEDIATION_ALL_CLOSED,
      title: 'All remediations closed',
      message: `All remediation items for assessment ${params.assessmentCode} (vendor: ${params.vendorName}) have been closed.`,
      relatedEntityType: 'assessment',
      relatedEntityId: params.assessmentId,
      link: `/tprm/am-follow-ups`,
      channels: params.channels,
      metadata: { entityName: params.assessmentCode, vendorName: params.vendorName },
    });
  }

  // ==================== TPRM VENDOR ISSUE ESCALATION ====================

  /**
   * Notify when a vendor issue is escalated.
   */
  async notifyTPRMVendorIssueEscalated(params: {
    customerAccountId: string;
    actorId: string;
    recipientIds: string[];
    issueId: string;
    issueTitle: string;
    vendorName: string;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_VENDOR_ISSUE_ESCALATED,
      title: 'Vendor issue escalated',
      message: `Vendor issue for ${params.vendorName} has been escalated: ${params.issueTitle}.`,
      relatedEntityType: 'vendor-issue',
      relatedEntityId: params.issueId,
      link: `/tprm/bo-follow-ups`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: params.channels,
      metadata: { entityName: params.issueTitle, vendorName: params.vendorName },
    });
  }

  // ==================== TPRM SCHEDULED REMINDERS ====================

  /**
   * Notify when TPRM assessment is approaching due date.
   */
  async notifyTPRMAssessmentDueReminder(params: {
    customerAccountId: string;
    recipientIds: string[];
    assessmentId: string;
    assessmentCode: string;
    vendorName: string;
    dueDate: string;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: 'system',
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_ASSESSMENT_DUE_REMINDER,
      title: 'Assessment due soon',
      message: `Assessment ${params.assessmentCode} for vendor ${params.vendorName} is due on ${params.dueDate}.`,
      relatedEntityType: 'assessment',
      relatedEntityId: params.assessmentId,
      link: `/tprm/asr-assessments/${params.assessmentId}`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: params.channels,
      metadata: { entityName: params.assessmentCode, vendorName: params.vendorName, dueDate: params.dueDate },
    });
  }

  /**
   * Notify when a vendor contract is approaching expiry.
   */
  async notifyTPRMContractExpiry(params: {
    customerAccountId: string;
    recipientIds: string[];
    vendorId: string;
    vendorName: string;
    expiryDate: string;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: 'system',
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_CONTRACT_EXPIRY,
      title: 'Vendor contract expiring soon',
      message: `Vendor ${params.vendorName} contract expires on ${params.expiryDate}. Please take action.`,
      relatedEntityType: 'vendor',
      relatedEntityId: params.vendorId,
      link: `/tprm/bo-inventory`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: params.channels,
      metadata: { vendorName: params.vendorName, expiryDate: params.expiryDate },
    });
  }

  /**
   * Notify an SME that an AM has delegated one or more questions to
   * them on a vendor assessment.
   *
   * The link points at the AM/vendor side of the assessment
   * (`/tprm/am-assessments/...`) — the prior implementation linked to
   * the assessor side, which SMEs can't access. actorId is now the AM
   * (not 'system') so the self-notification guard works correctly.
   */
  async notifyTPRMSMEAssignmentPending(params: {
    customerAccountId: string;
    actorId: string;
    recipientId: string;
    assessmentId: string;
    assessmentCode: string;
    vendorName?: string;
    channels?: NotificationChannel[];
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.recipientId,
      event: NOTIFICATION_EVENTS.TPRM_SME_ASSIGNMENT_PENDING,
      title: 'Question(s) assigned to you',
      message: params.vendorName
        ? `You've been assigned question(s) on assessment ${params.assessmentCode} for vendor ${params.vendorName}.`
        : `You've been assigned question(s) on assessment ${params.assessmentCode}.`,
      relatedEntityType: 'assessment',
      relatedEntityId: params.assessmentId,
      link: `/tprm/am-assessments/${params.assessmentId}`,
      channels: params.channels,
      metadata: { entityName: params.assessmentCode, vendorName: params.vendorName },
    });
  }

  /**
   * Notify when a cadence-based periodic reassessment is auto-created by the system.
   */
  async notifyTPRMCadenceReassessment(params: {
    customerAccountId: string;
    recipientIds: string[];
    newAssessmentId: string;
    newAssessmentCode: string;
    vendorName: string;
    vrrCategory: string;
    cadenceMonths: number;
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: 'system',
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_CADENCE_REASSESSMENT,
      title: 'Periodic reassessment created',
      message: `A periodic reassessment (${params.newAssessmentCode}) has been automatically created for vendor ${params.vendorName} based on ${params.vrrCategory} risk cadence (${params.cadenceMonths} month${params.cadenceMonths !== 1 ? 's' : ''}).`,
      relatedEntityType: 'assessment',
      relatedEntityId: params.newAssessmentId,
      link: `/tprm/rm-assessments`,
      metadata: { entityName: params.newAssessmentCode },
    });
  }

  /**
   * Notify all stakeholders that a remediation item is due soon (X days before dueDate).
   */
  async notifyTPRMRemediationDueReminder(params: {
    customerAccountId: string;
    recipientIds: string[];
    remediationId: string;
    issueCode: string;
    vendorName: string;
    questionTitle: string;
    dueDate: string;
    daysUntilDue: number;
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: 'system',
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_REMEDIATION_DUE_REMINDER,
      title: 'Remediation due soon',
      message: `Remediation ${params.issueCode} for vendor ${params.vendorName} is due in ${params.daysUntilDue} day${params.daysUntilDue !== 1 ? 's' : ''} (${params.dueDate}). Please complete and close the remediation.`,
      relatedEntityType: 'remediation',
      relatedEntityId: params.remediationId,
      link: `/tprm/asr-follow-ups`,
      metadata: { entityName: params.issueCode },
    });
  }

  // ==================== MAINTENANCE METHODS ====================

  /**
   * Cleanup old read notifications.
   * Run this as a scheduled job.
   */
  async cleanup(daysOld = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.notification.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          isRead: true,
        },
      });

      console.log(`[NotificationService] Cleaned up ${result.count} old notifications`);
      return result;
    } catch (error) {
      console.error('[NotificationService] Cleanup error:', error);
      throw error;
    }
  }

  // ==================== TPRM CONTRACT DELETION ====================

  async notifyTPRMContractDeletionRequested(params: {
    customerAccountId: string;
    actorId: string;
    recipientIds: string[];
    vendorName: string;
    fileName: string;
    reason: string;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_CONTRACT_DELETION_REQUESTED,
      title: 'Contract deletion requested',
      message: `A deletion request has been submitted for contract "${params.fileName}" of vendor ${params.vendorName}. Reason: ${params.reason}`,
      link: `/tprm/vendor-management`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: params.channels,
      metadata: { vendorName: params.vendorName, fileName: params.fileName, reason: params.reason },
    });
  }

  async notifyTPRMContractDeletionApproved(params: {
    customerAccountId: string;
    actorId: string;
    recipientIds: string[];
    vendorName: string;
    fileName: string;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_CONTRACT_DELETION_APPROVED,
      title: 'Contract deletion approved',
      message: `Your request to delete contract "${params.fileName}" of vendor ${params.vendorName} has been approved. The document has been archived.`,
      link: `/tprm/rm-inventory`,
      channels: params.channels,
      metadata: { vendorName: params.vendorName, fileName: params.fileName },
    });
  }

  async notifyTPRMContractDeletionRejected(params: {
    customerAccountId: string;
    actorId: string;
    recipientIds: string[];
    vendorName: string;
    fileName: string;
    reviewNote?: string;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_CONTRACT_DELETION_REJECTED,
      title: 'Contract deletion rejected',
      message: `Your request to delete contract "${params.fileName}" of vendor ${params.vendorName} has been rejected.${params.reviewNote ? ` Note: ${params.reviewNote}` : ''}`,
      link: `/tprm/rm-inventory`,
      channels: params.channels,
      metadata: { vendorName: params.vendorName, fileName: params.fileName, reviewNote: params.reviewNote },
    });
  }

  async notifyTPRMContractDeletedByAdmin(params: {
    customerAccountId: string;
    actorId: string;
    recipientIds: string[];
    vendorName: string;
    fileName: string;
    reason?: string;
    channels?: NotificationChannel[];
  }) {
    return this.sendBulk({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientIds: params.recipientIds,
      event: NOTIFICATION_EVENTS.TPRM_CONTRACT_DELETED_BY_ADMIN,
      title: 'Contract deleted by administrator',
      message: `Contract "${params.fileName}" of vendor ${params.vendorName} has been deleted by the administrator.${params.reason ? ` Reason: ${params.reason}` : ''}`,
      link: `/tprm/rm-inventory`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: params.channels,
      metadata: { vendorName: params.vendorName, fileName: params.fileName, reason: params.reason },
    });
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

// ==================== DOCUMENTATION ====================
/**
 * USAGE EXAMPLES:
 *
 * // In an API route when assigning evidence:
 * import { notificationService } from '@/lib/notification-service';
 *
 * // When updating evidence assignee
 * if (newAssigneeId && newAssigneeId !== currentUserId) {
 *   await notificationService.notifyEvidenceAssigned({
 *     customerAccountId: session.customerAccountId,
 *     actorId: session.id, // The user making the change
 *     assigneeId: newAssigneeId, // The new assignee
 *     evidenceId: evidence.id,
 *     evidenceName: evidence.name,
 *     controlCode: evidence.control?.code,
 *   });
 * }
 *
 * // When adding a comment:
 * await notificationService.notifyCommentAdded({
 *   customerAccountId,
 *   actorId: session.id,
 *   recipientId: entity.ownerId,
 *   entityType: 'risk',
 *   entityId: risk.id,
 *   entityName: risk.name,
 *   commentPreview: comment.text.substring(0, 100),
 *   link: `/risk-management/register/${risk.id}`,
 * });
 *
 * // Self-notification is automatically prevented:
 * await notificationService.send({
 *   actorId: 'user123',
 *   recipientId: 'user123', // Same as actor
 *   // ... other fields
 * });
 * // Result: { success: false, error: 'Self-notification prevented...' }
 */
