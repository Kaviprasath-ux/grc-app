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
 * - Channel-aware: Inbox now, Email later (via NotificationChannel)
 * - Decoupled from UI pages and widgets
 */

import { prisma } from '@/lib/prisma';
import { sendTemplatedEmail, getUserInfo, TemplatePlaceholders } from './email-service';

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

    const channels = payload.channels || [NOTIFICATION_CHANNELS.INBOX];

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

    const channels = payload.channels || [NOTIFICATION_CHANNELS.INBOX];
    let successCount = 0;

    try {
      for (const channel of channels) {
        switch (channel) {
          case NOTIFICATION_CHANNELS.INBOX:
            const result = await prisma.notification.createMany({
              data: validRecipients.map(recipientId => ({
                customerAccountId: payload.customerAccountId,
                userId: recipientId,
                type: payload.event,
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
   */
  private async sendEmailNotification(payload: NotificationPayload): Promise<void> {
    try {
      // Get recipient info
      const userInfo = await getUserInfo(payload.recipientId);
      if (!userInfo) {
        console.log('[NotificationService] Cannot send email - user not found:', payload.recipientId);
        return;
      }

      // Map notification event to email template code
      const templateCode = this.getEmailTemplateCode(payload.event);

      // Build placeholders for the template
      const placeholders: TemplatePlaceholders = {
        title: payload.title,
        message: payload.message,
        entityLink: payload.link
          ? `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}${payload.link}`
          : undefined,
        entityType: payload.relatedEntityType,
        entityName: payload.metadata?.entityName as string,
        actorName: payload.metadata?.actorName as string,
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
   */
  private getEmailTemplateCode(event: NotificationEvent): string {
    const templateMap: Record<NotificationEvent, string> = {
      [NOTIFICATION_EVENTS.EVIDENCE_ASSIGNED]: 'EVIDENCE_ASSIGNED',
      [NOTIFICATION_EVENTS.RISK_ASSIGNED]: 'RISK_ASSIGNED',
      [NOTIFICATION_EVENTS.CAPA_ASSIGNED]: 'CAPA_ASSIGNED',
      [NOTIFICATION_EVENTS.CONTROL_ASSIGNED]: 'GENERIC_NOTIFICATION',
      [NOTIFICATION_EVENTS.ASSET_ASSIGNED]: 'GENERIC_NOTIFICATION',
      [NOTIFICATION_EVENTS.ENGAGEMENT_ASSIGNED]: 'GENERIC_NOTIFICATION',
      [NOTIFICATION_EVENTS.POLICY_ASSIGNED]: 'GENERIC_NOTIFICATION',
      [NOTIFICATION_EVENTS.PROCESS_ASSIGNED]: 'GENERIC_NOTIFICATION',
      [NOTIFICATION_EVENTS.COMMENT_ADDED]: 'GENERIC_NOTIFICATION',
      [NOTIFICATION_EVENTS.APPROVAL_REQUESTED]: 'APPROVAL_REQUESTED',
      [NOTIFICATION_EVENTS.APPROVAL_GRANTED]: 'GENERIC_NOTIFICATION',
      [NOTIFICATION_EVENTS.APPROVAL_DENIED]: 'GENERIC_NOTIFICATION',
      [NOTIFICATION_EVENTS.SENT_BACK]: 'GENERIC_NOTIFICATION',
      [NOTIFICATION_EVENTS.FEEDBACK_REQUESTED]: 'GENERIC_NOTIFICATION',
      [NOTIFICATION_EVENTS.EVIDENCE_DUE_REMINDER]: 'DUE_REMINDER',
      [NOTIFICATION_EVENTS.CAPA_DUE_REMINDER]: 'DUE_REMINDER',
      [NOTIFICATION_EVENTS.REVIEW_DUE_REMINDER]: 'DUE_REMINDER',
      [NOTIFICATION_EVENTS.STATUS_CHANGED]: 'GENERIC_NOTIFICATION',
      [NOTIFICATION_EVENTS.SYSTEM_ANNOUNCEMENT]: 'GENERIC_NOTIFICATION',
      [NOTIFICATION_EVENTS.USER_CREATED]: 'GENERIC_NOTIFICATION',
      [NOTIFICATION_EVENTS.CUSTOMER_ONBOARDED]: 'GENERIC_NOTIFICATION',
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
      link: `/risk-management/register/${params.riskId}`,
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
      link: `/asset-management/inventory/${params.assetId}`,
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
      link: `/internal-audit/capa-tracking/${params.capaId}`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
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
    });
  }

  /**
   * Notify when feedback is requested from a user.
   * Use cases: Evidence requests, review requests, clarification requests, etc.
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
  }) {
    return this.send({
      customerAccountId: params.customerAccountId,
      actorId: params.actorId,
      recipientId: params.newUserId,
      event: NOTIFICATION_EVENTS.USER_CREATED,
      title: 'Welcome to GRC Platform',
      message: `Welcome ${params.userName}! Your account has been created successfully.`,
      link: '/dashboard',
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
