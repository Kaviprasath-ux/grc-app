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
        // Silently fallback if notifications table doesn't exist yet
        setNotifications([]);
        return;
      }

      const data = await response.json();
      setNotifications(data.notifications);
      setPagination(data.pagination);
    } catch (err) {
      // Silently handle - notifications may not be set up yet
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/unread-count');

      if (!response.ok) {
        // Silently fallback if notifications table doesn't exist yet
        setUnreadCount(0);
        return;
      }

      const data = await response.json();
      setUnreadCount(data.count);
    } catch (err) {
      // Silently handle - notifications may not be set up yet
      setUnreadCount(0);
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

// Re-export notification events from constants (client-safe, no server dependencies)
export { NOTIFICATION_EVENTS } from '@/lib/notification-constants';

// Helper to get icon and color based on notification type
export function getNotificationStyle(type: string): {
  icon: 'clock' | 'user' | 'bell' | 'check' | 'alert' | 'info' | 'comment' | 'send-back';
  bgColor: string;
  textColor: string;
} {
  // Due date reminders
  if (type.includes('DUE_REMINDER') || type.includes('_DUE')) {
    return { icon: 'clock', bgColor: 'bg-amber-100', textColor: 'text-amber-600' };
  }

  // Assignments
  if (type.includes('_ASSIGNED')) {
    return { icon: 'user', bgColor: 'bg-blue-100', textColor: 'text-blue-600' };
  }

  // Comments
  if (type === 'COMMENT_ADDED') {
    return { icon: 'comment', bgColor: 'bg-indigo-100', textColor: 'text-indigo-600' };
  }

  // Approvals
  if (type === 'APPROVAL_REQUESTED') {
    return { icon: 'bell', bgColor: 'bg-purple-100', textColor: 'text-purple-600' };
  }
  if (type === 'APPROVAL_GRANTED') {
    return { icon: 'check', bgColor: 'bg-green-100', textColor: 'text-green-600' };
  }
  if (type === 'APPROVAL_DENIED') {
    return { icon: 'alert', bgColor: 'bg-red-100', textColor: 'text-red-600' };
  }

  // Send backs
  if (type === 'SENT_BACK') {
    return { icon: 'send-back', bgColor: 'bg-orange-100', textColor: 'text-orange-600' };
  }

  // User/Account events
  if (type === 'USER_CREATED' || type === 'CUSTOMER_ONBOARDED') {
    return { icon: 'user', bgColor: 'bg-teal-100', textColor: 'text-teal-600' };
  }

  // System announcements
  if (type === 'SYSTEM_ANNOUNCEMENT') {
    return { icon: 'bell', bgColor: 'bg-slate-100', textColor: 'text-slate-600' };
  }

  // Default
  return { icon: 'info', bgColor: 'bg-slate-100', textColor: 'text-slate-600' };
}
