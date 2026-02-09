/**
 * Notification Service
 *
 * Server-side service for creating and managing notifications.
 * Use this service in API routes to trigger notifications when events occur.
 *
 * Example usage:
 * ```typescript
 * import { notificationService } from '@/lib/notification-service';
 *
 * // In an API route after creating an evidence request
 * await notificationService.create({
 *   customerAccountId: session.customerAccountId,
 *   userId: assignee.id,
 *   type: 'EVIDENCE_DUE',
 *   title: 'Evidence request assigned',
 *   message: `You have been assigned to provide evidence for control ${control.code}`,
 *   relatedEntityType: 'evidence',
 *   relatedEntityId: evidence.id,
 *   link: `/compliance/evidence/${evidence.id}`,
 * });
 * ```
 */

import { prisma } from '@/lib/prisma';

// Notification types - matches the constants in useNotifications hook
export const NOTIFICATION_TYPES = {
  // Evidence
  EVIDENCE_DUE: 'EVIDENCE_DUE',
  EVIDENCE_SUBMITTED: 'EVIDENCE_SUBMITTED',
  EVIDENCE_APPROVED: 'EVIDENCE_APPROVED',
  EVIDENCE_REJECTED: 'EVIDENCE_REJECTED',

  // Risk
  RISK_ASSIGNED: 'RISK_ASSIGNED',
  RISK_STATUS_CHANGED: 'RISK_STATUS_CHANGED',
  RISK_ASSESSMENT_DUE: 'RISK_ASSESSMENT_DUE',

  // Audit
  AUDIT_FINDING: 'AUDIT_FINDING',
  AUDIT_ASSIGNED: 'AUDIT_ASSIGNED',
  ENGAGEMENT_ASSIGNED: 'ENGAGEMENT_ASSIGNED',

  // CAPA
  CAPA_DUE: 'CAPA_DUE',
  CAPA_ASSIGNED: 'CAPA_ASSIGNED',
  CAPA_STATUS_CHANGED: 'CAPA_STATUS_CHANGED',

  // Control
  CONTROL_REVIEW_DUE: 'CONTROL_REVIEW_DUE',
  CONTROL_ASSIGNED: 'CONTROL_ASSIGNED',

  // Approval
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  APPROVAL_GRANTED: 'APPROVAL_GRANTED',
  APPROVAL_DENIED: 'APPROVAL_DENIED',

  // System
  SYSTEM: 'SYSTEM',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface CreateNotificationParams {
  /** Customer account ID for multi-tenant isolation */
  customerAccountId: string;
  /** Recipient user ID */
  userId: string;
  /** Notification type */
  type: NotificationType | string;
  /** Notification title (short, shown in header) */
  title: string;
  /** Notification message (can be longer, shown in detail) */
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
}

export interface BulkCreateNotificationParams extends Omit<CreateNotificationParams, 'userId'> {
  /** Array of recipient user IDs */
  userIds: string[];
}

class NotificationService {
  /**
   * Create a single notification
   */
  async create(params: CreateNotificationParams) {
    const {
      customerAccountId,
      userId,
      type,
      title,
      message,
      relatedEntityType,
      relatedEntityId,
      link,
      priority = 'normal',
      metadata,
    } = params;

    try {
      const notification = await prisma.notification.create({
        data: {
          customerAccountId,
          userId,
          type,
          title,
          message,
          relatedEntityType,
          relatedEntityId,
          link,
          priority,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Create notifications for multiple users at once
   */
  async createBulk(params: BulkCreateNotificationParams) {
    const {
      customerAccountId,
      userIds,
      type,
      title,
      message,
      relatedEntityType,
      relatedEntityId,
      link,
      priority = 'normal',
      metadata,
    } = params;

    if (userIds.length === 0) {
      return [];
    }

    try {
      const notifications = await prisma.notification.createMany({
        data: userIds.map(userId => ({
          customerAccountId,
          userId,
          type,
          title,
          message,
          relatedEntityType,
          relatedEntityId,
          link,
          priority,
          metadata: metadata ? JSON.stringify(metadata) : null,
        })),
      });

      return notifications;
    } catch (error) {
      console.error('Error creating bulk notifications:', error);
      throw error;
    }
  }

  /**
   * Send notification to all users in a department
   */
  async notifyDepartment(
    customerAccountId: string,
    departmentId: string,
    params: Omit<CreateNotificationParams, 'customerAccountId' | 'userId'>
  ) {
    try {
      // Get all users in the department
      const users = await prisma.user.findMany({
        where: {
          customerAccountId,
          departmentId,
          isActive: true,
        },
        select: { id: true },
      });

      if (users.length === 0) {
        return { count: 0 };
      }

      return this.createBulk({
        customerAccountId,
        userIds: users.map(u => u.id),
        ...params,
      });
    } catch (error) {
      console.error('Error notifying department:', error);
      throw error;
    }
  }

  /**
   * Send notification to all users with a specific role
   */
  async notifyByRole(
    customerAccountId: string,
    roleName: string,
    params: Omit<CreateNotificationParams, 'customerAccountId' | 'userId'>
  ) {
    try {
      // Get all users with the specified role
      const users = await prisma.user.findMany({
        where: {
          customerAccountId,
          isActive: true,
          userRoles: {
            some: {
              role: {
                name: roleName,
              },
            },
          },
        },
        select: { id: true },
      });

      if (users.length === 0) {
        return { count: 0 };
      }

      return this.createBulk({
        customerAccountId,
        userIds: users.map(u => u.id),
        ...params,
      });
    } catch (error) {
      console.error('Error notifying by role:', error);
      throw error;
    }
  }

  /**
   * Delete old notifications (cleanup job)
   * @param daysOld - Delete notifications older than this many days
   */
  async cleanup(daysOld = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
          isRead: true, // Only delete read notifications
        },
      });

      console.log(`Deleted ${result.count} old notifications`);
      return result;
    } catch (error) {
      console.error('Error cleaning up notifications:', error);
      throw error;
    }
  }

  // ==================== CONVENIENCE METHODS ====================

  /**
   * Notify when evidence is due
   */
  async notifyEvidenceDue(
    customerAccountId: string,
    userId: string,
    evidenceId: string,
    evidenceName: string,
    dueDate: Date
  ) {
    return this.create({
      customerAccountId,
      userId,
      type: NOTIFICATION_TYPES.EVIDENCE_DUE,
      title: 'Evidence due soon',
      message: `Evidence "${evidenceName}" is due on ${dueDate.toLocaleDateString()}`,
      relatedEntityType: 'evidence',
      relatedEntityId: evidenceId,
      link: `/compliance/evidence/${evidenceId}`,
      priority: 'high',
    });
  }

  /**
   * Notify when a risk is assigned
   */
  async notifyRiskAssigned(
    customerAccountId: string,
    userId: string,
    riskId: string,
    riskCode: string,
    riskName: string
  ) {
    return this.create({
      customerAccountId,
      userId,
      type: NOTIFICATION_TYPES.RISK_ASSIGNED,
      title: 'Risk assigned to you',
      message: `Risk ${riskCode}: ${riskName} has been assigned to you`,
      relatedEntityType: 'risk',
      relatedEntityId: riskId,
      link: `/risk-management/register/${riskId}`,
    });
  }

  /**
   * Notify when an audit engagement is assigned
   */
  async notifyEngagementAssigned(
    customerAccountId: string,
    userId: string,
    engagementId: string,
    engagementCode: string,
    engagementName: string,
    role: string
  ) {
    return this.create({
      customerAccountId,
      userId,
      type: NOTIFICATION_TYPES.ENGAGEMENT_ASSIGNED,
      title: 'Audit engagement assigned',
      message: `You have been assigned as ${role} for engagement ${engagementCode}: ${engagementName}`,
      relatedEntityType: 'engagement',
      relatedEntityId: engagementId,
      link: `/internal-audit/fieldwork/${engagementId}`,
    });
  }

  /**
   * Notify when a CAPA is assigned
   */
  async notifyCAPAAssigned(
    customerAccountId: string,
    userId: string,
    capaId: string,
    capaCode: string,
    capaTitle: string
  ) {
    return this.create({
      customerAccountId,
      userId,
      type: NOTIFICATION_TYPES.CAPA_ASSIGNED,
      title: 'CAPA assigned to you',
      message: `CAPA ${capaCode}: ${capaTitle} has been assigned to you`,
      relatedEntityType: 'capa',
      relatedEntityId: capaId,
      link: `/internal-audit/capa-tracking/${capaId}`,
    });
  }

  /**
   * Notify when approval is required
   */
  async notifyApprovalRequired(
    customerAccountId: string,
    userId: string,
    entityType: string,
    entityId: string,
    entityName: string,
    link: string
  ) {
    return this.create({
      customerAccountId,
      userId,
      type: NOTIFICATION_TYPES.APPROVAL_REQUIRED,
      title: 'Approval required',
      message: `Your approval is required for ${entityType}: ${entityName}`,
      relatedEntityType: entityType,
      relatedEntityId: entityId,
      link,
      priority: 'high',
    });
  }

  /**
   * Send a system announcement to all users in a customer account
   */
  async sendAnnouncement(
    customerAccountId: string,
    title: string,
    message: string
  ) {
    try {
      const users = await prisma.user.findMany({
        where: {
          customerAccountId,
          isActive: true,
        },
        select: { id: true },
      });

      if (users.length === 0) {
        return { count: 0 };
      }

      return this.createBulk({
        customerAccountId,
        userIds: users.map(u => u.id),
        type: NOTIFICATION_TYPES.ANNOUNCEMENT,
        title,
        message,
        priority: 'normal',
      });
    } catch (error) {
      console.error('Error sending announcement:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
