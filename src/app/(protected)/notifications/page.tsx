"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Trash2, Clock, User, AlertTriangle, CheckCircle, Info, MessageSquare, RotateCcw, RefreshCw, Home, ChevronRight, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { useModule } from "@/contexts/ModuleContext";
import { useNotifications, getNotificationStyle, Notification } from "@/hooks/useNotifications";

// Helper function to get icon component based on notification type
function NotificationIcon({ type, className = "h-4 w-4" }: { type: string; className?: string }) {
  const style = getNotificationStyle(type);

  switch (style.icon) {
    case 'clock':
      return <Clock className={className} />;
    case 'user':
      return <User className={className} />;
    case 'alert':
      return <AlertTriangle className={className} />;
    case 'check':
      return <CheckCircle className={className} />;
    case 'bell':
      return <Bell className={className} />;
    case 'comment':
      return <MessageSquare className={className} />;
    case 'send-back':
      return <RotateCcw className={className} />;
    default:
      return <Info className={className} />;
  }
}

export default function NotificationsPage() {
  const { t } = useLanguage();
  const { currentModule } = useModule();
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const {
    notifications,
    unreadCount,
    pagination,
    isLoading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
  } = useNotifications({
    autoFetch: true,
    pollingInterval: 30000,
    limit: 20,
    // Scope the notifications list to the current workspace.
    module: currentModule,
  });

  // Fetch notifications when filter changes
  useEffect(() => {
    fetchNotifications(1, filter === 'unread');
  }, [filter, fetchNotifications]);

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  // Format notification time
  const formatNotificationTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return '';
    }
  };

  // Format full date
  const formatFullDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'PPpp');
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Home className="h-4 w-4" />
          <span>{t("Home")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Notifications")}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{t("Notifications")}</h1>
          <p className="text-xs text-slate-400 mt-1">
            {unreadCount > 0
              ? t("You have {{count}} unread notifications").replace('{{count}}', String(unreadCount))
              : t("You're all caught up!")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refresh()}
            disabled={isLoading}
            className="text-slate-500 hover:text-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            {t("Refresh")}
          </Button>

          {/* Filter tabs */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setFilter('all')}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                filter === 'all' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t("All")}
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                filter === 'unread' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t("Unread")}
              {unreadCount > 0 && (
                <span className="ltr:ml-1.5 rtl:mr-1.5 text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead()}
              className="text-slate-500 hover:text-primary-600"
            >
              <CheckCheck className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
              {t("Mark all read")}
            </Button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Notifications list */}
      <div className="bg-white rounded-lg border border-slate-200">
        {isLoading && notifications.length === 0 ? (
          <div className="py-16 text-center">
            <RefreshCw className="h-5 w-5 mx-auto mb-3 animate-spin text-slate-300" />
            <p className="text-xs text-slate-400">{t("Loading notifications...")}</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
              <Bell className="h-6 w-6 text-primary-400" />
            </div>
            <p className="text-sm font-medium text-slate-600 mb-1">
              {filter === 'unread' ? t("No unread notifications") : t("No notifications yet")}
            </p>
            <p className="text-xs text-slate-400">
              {filter === 'unread'
                ? t("You've read all your notifications")
                : t("When you receive notifications, they'll appear here")}
            </p>
          </div>
        ) : (
          <div>
            {notifications.map((notification, idx) => {
              const style = getNotificationStyle(notification.type);
              return (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 px-5 py-3.5 cursor-pointer transition-colors hover:bg-slate-50 ${
                    idx !== notifications.length - 1 ? 'border-b border-slate-50' : ''
                  } ${!notification.isRead ? 'bg-primary-50/20' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {/* Icon */}
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.bgColor} ${style.textColor} mt-0.5`}>
                    <NotificationIcon type={notification.type} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm text-slate-700 ${!notification.isRead ? 'font-semibold' : 'font-medium'}`}>
                        {notification.title}
                      </p>
                      {!notification.isRead && (
                        <div className="h-2 w-2 rounded-full bg-primary-500 shrink-0 mt-1.5" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notification.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] text-slate-400" title={formatFullDate(notification.createdAt)}>
                        {formatNotificationTime(notification.createdAt)}
                      </span>
                      {notification.relatedEntityType && (
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {notification.relatedEntityType}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notification.isRead && (
                      <button
                        className="p-1.5 rounded-md text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                        title={t("Mark as read")}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      title={t("Delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <p className="text-[11px] text-slate-400">
              {t("Page {{current}} of {{total}}")
                .replace('{{current}}', String(pagination.page))
                .replace('{{total}}', String(pagination.totalPages))}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                disabled={pagination.page <= 1}
                onClick={() => fetchNotifications(pagination.page - 1, filter === 'unread')}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchNotifications(pagination.page + 1, filter === 'unread')}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
