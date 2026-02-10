/**
 * Notification Constants
 *
 * Shared constants for the notification system.
 * This file can be safely imported in both client and server code.
 */

// ==================== NOTIFICATION CHANNELS ====================
export const NOTIFICATION_CHANNELS = {
  INBOX: 'inbox',
  EMAIL: 'email',
} as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS];

// ==================== NOTIFICATION EVENTS ====================
export const NOTIFICATION_EVENTS = {
  // Assignment events
  EVIDENCE_ASSIGNED: 'EVIDENCE_ASSIGNED',
  RISK_ASSIGNED: 'RISK_ASSIGNED',
  CAPA_ASSIGNED: 'CAPA_ASSIGNED',
  CONTROL_ASSIGNED: 'CONTROL_ASSIGNED',
  ASSET_ASSIGNED: 'ASSET_ASSIGNED',
  ENGAGEMENT_ASSIGNED: 'ENGAGEMENT_ASSIGNED',
  POLICY_ASSIGNED: 'POLICY_ASSIGNED',
  PROCESS_ASSIGNED: 'PROCESS_ASSIGNED',

  // Collaboration events
  COMMENT_ADDED: 'COMMENT_ADDED',
  APPROVAL_REQUESTED: 'APPROVAL_REQUESTED',
  APPROVAL_GRANTED: 'APPROVAL_GRANTED',
  APPROVAL_DENIED: 'APPROVAL_DENIED',
  SENT_BACK: 'SENT_BACK',
  FEEDBACK_REQUESTED: 'FEEDBACK_REQUESTED',

  // AI-generated events
  ISSUE_EVIDENCE: 'ISSUE_EVIDENCE',

  // Reminder events
  EVIDENCE_DUE_REMINDER: 'EVIDENCE_DUE_REMINDER',
  CAPA_DUE_REMINDER: 'CAPA_DUE_REMINDER',
  REVIEW_DUE_REMINDER: 'REVIEW_DUE_REMINDER',

  // Status change events
  STATUS_CHANGED: 'STATUS_CHANGED',

  // System events
  SYSTEM_ANNOUNCEMENT: 'SYSTEM_ANNOUNCEMENT',
  USER_CREATED: 'USER_CREATED',
  CUSTOMER_ONBOARDED: 'CUSTOMER_ONBOARDED',
} as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];

// ==================== NOTIFICATION PRIORITIES ====================
export const NOTIFICATION_PRIORITIES = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[keyof typeof NOTIFICATION_PRIORITIES];
