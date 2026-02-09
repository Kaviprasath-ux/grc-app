/**
 * useNotifications Hook
 *
 * Provides notification functionality for the frontend:
 * - Fetch notifications with pagination
 * - Get unread count
 * - Mark notifications as read
 * - Mark all as read
 * - Delete notifications
 * - Auto-refresh with polling
 */

import { useState, useEffect, useCallback } from 'react';

export interface Notification {
  id: string;
  customerAccountId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  link: string | null;
  priority: string;
  isRead: boolean;
  readAt: string | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface UseNotificationsOptions {
  /** Auto-fetch on mount */
  autoFetch?: boolean;
  /** Polling interval in milliseconds (0 to disable) */
  pollingInterval?: number;
  /** Number of notifications per page */
  limit?: number;
}

interface UseNotificationsReturn {
  /** List of notifications */
  notifications: Notification[];
  /** Unread notification count */
  unreadCount: number;
  /** Pagination info */
  pagination: NotificationPagination | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Fetch notifications */
  fetchNotifications: (page?: number, unreadOnly?: boolean) => Promise<void>;
  /** Fetch unread count */
  fetchUnreadCount: () => Promise<void>;
  /** Mark a notification as read */
  markAsRead: (id: string) => Promise<void>;
  /** Mark all notifications as read */
  markAllAsRead: () => Promise<void>;
  /** Delete a notification */
  deleteNotification: (id: string) => Promise<void>;
  /** Refresh both notifications and count */
  refresh: () => Promise<void>;
}

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const {
    autoFetch = true,
    pollingInterval = 60000, // Poll every 60 seconds by default
    limit = 20,
  } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState<NotificationPagination | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async (page = 1, unreadOnly = false) => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(unreadOnly && { unreadOnly: 'true' }),
      });

      const response = await fetch(`/api/notifications?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      setNotifications(data.notifications);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/unread-count');

      if (!response.ok) {
        throw new Error('Failed to fetch unread count');
      }

      const data = await response.json();
      setUnreadCount(data.count);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as read');
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PATCH',
      });

      if (!response.ok) {
        throw new Error('Failed to mark all as read');
      }

      // Update local state
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark all as read');
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (id: string) => {
    try {
      const notification = notifications.find(n => n.id === id);

      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }

      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== id));

      // Update unread count if the deleted notification was unread
      if (notification && !notification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete notification');
    }
  }, [notifications]);

  // Refresh both notifications and count
  const refresh = useCallback(async () => {
    await Promise.all([
      fetchNotifications(),
      fetchUnreadCount(),
    ]);
  }, [fetchNotifications, fetchUnreadCount]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
  }, [autoFetch, refresh]);

  // Set up polling
  useEffect(() => {
    if (pollingInterval <= 0) return;

    const intervalId = setInterval(() => {
      fetchUnreadCount();
    }, pollingInterval);

    return () => clearInterval(intervalId);
  }, [pollingInterval, fetchUnreadCount]);

  return {
    notifications,
    unreadCount,
    pagination,
    isLoading,
    error,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
  };
}

// Notification type constants for consistency
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

// Helper to get icon and color based on notification type
export function getNotificationStyle(type: string): {
  icon: 'clock' | 'user' | 'bell' | 'check' | 'alert' | 'info';
  bgColor: string;
  textColor: string;
} {
  switch (type) {
    case NOTIFICATION_TYPES.EVIDENCE_DUE:
    case NOTIFICATION_TYPES.CAPA_DUE:
    case NOTIFICATION_TYPES.RISK_ASSESSMENT_DUE:
    case NOTIFICATION_TYPES.CONTROL_REVIEW_DUE:
      return { icon: 'clock', bgColor: 'bg-amber-100', textColor: 'text-amber-600' };

    case NOTIFICATION_TYPES.RISK_ASSIGNED:
    case NOTIFICATION_TYPES.AUDIT_ASSIGNED:
    case NOTIFICATION_TYPES.ENGAGEMENT_ASSIGNED:
    case NOTIFICATION_TYPES.CAPA_ASSIGNED:
    case NOTIFICATION_TYPES.CONTROL_ASSIGNED:
      return { icon: 'user', bgColor: 'bg-blue-100', textColor: 'text-blue-600' };

    case NOTIFICATION_TYPES.AUDIT_FINDING:
    case NOTIFICATION_TYPES.APPROVAL_DENIED:
    case NOTIFICATION_TYPES.EVIDENCE_REJECTED:
      return { icon: 'alert', bgColor: 'bg-red-100', textColor: 'text-red-600' };

    case NOTIFICATION_TYPES.APPROVAL_GRANTED:
    case NOTIFICATION_TYPES.EVIDENCE_APPROVED:
      return { icon: 'check', bgColor: 'bg-green-100', textColor: 'text-green-600' };

    case NOTIFICATION_TYPES.APPROVAL_REQUIRED:
      return { icon: 'bell', bgColor: 'bg-purple-100', textColor: 'text-purple-600' };

    default:
      return { icon: 'info', bgColor: 'bg-slate-100', textColor: 'text-slate-600' };
  }
}
