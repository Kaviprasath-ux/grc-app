"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Trash2, Clock, User, AlertTriangle, CheckCircle, Info, MessageSquare, RotateCcw, Filter, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotifications, getNotificationStyle, Notification } from "@/hooks/useNotifications";

// Helper function to get icon component based on notification type
function NotificationIcon({ type, className = "h-5 w-5" }: { type: string; className?: string }) {
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
    pollingInterval: 30000, // Poll every 30 seconds
    limit: 20,
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t("Notifications")}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {unreadCount > 0
              ? t("You have {{count}} unread notifications").replace('{{count}}', String(unreadCount))
              : t("You're all caught up!")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 me-2 ${isLoading ? 'animate-spin' : ''}`} />
            {t("Refresh")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 me-2" />
                {filter === 'all' ? t("All") : t("Unread")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setFilter('all')}>
                {t("All notifications")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('unread')}>
                {t("Unread only")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAsRead()}
            >
              <CheckCheck className="h-4 w-4 me-2" />
              {t("Mark all read")}
            </Button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Notifications list */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary-500" />
            {filter === 'all' ? t("All Notifications") : t("Unread Notifications")}
            {pagination && (
              <Badge variant="secondary" className="ms-2">
                {pagination.total}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && notifications.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin text-primary-500" />
              <p>{t("Loading notifications...")}</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <h3 className="text-lg font-medium text-slate-700 mb-1">
                {filter === 'unread' ? t("No unread notifications") : t("No notifications yet")}
              </h3>
              <p className="text-sm text-slate-500">
                {filter === 'unread'
                  ? t("You've read all your notifications")
                  : t("When you receive notifications, they'll appear here")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((notification) => {
                const style = getNotificationStyle(notification.type);
                return (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-4 p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                      !notification.isRead ? 'bg-primary-50/30' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Icon */}
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style.bgColor} ${style.textColor}`}>
                      <NotificationIcon type={notification.type} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={`text-sm text-slate-800 ${!notification.isRead ? 'font-semibold' : 'font-medium'}`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-slate-600 mt-0.5">
                            {notification.message}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <div className="h-2.5 w-2.5 rounded-full bg-primary-500 shrink-0 mt-1.5" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-slate-400" title={formatFullDate(notification.createdAt)}>
                          {formatNotificationTime(notification.createdAt)}
                        </span>
                        {notification.relatedEntityType && (
                          <Badge variant="outline" className="text-xs">
                            {notification.relatedEntityType}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-primary-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                          title={t("Mark as read")}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        title={t("Delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-slate-500">
                {t("Page {{current}} of {{total}}")
                  .replace('{{current}}', String(pagination.page))
                  .replace('{{total}}', String(pagination.totalPages))}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchNotifications(pagination.page - 1, filter === 'unread')}
                >
                  {t("Previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchNotifications(pagination.page + 1, filter === 'unread')}
                >
                  {t("Next")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
