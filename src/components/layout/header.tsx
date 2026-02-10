"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, Menu, ChevronDown, LogOut, User, Settings, Calendar, Clock, ChevronLeft, Globe, Check, AlertTriangle, CheckCircle, Info, MessageSquare, RotateCcw } from "lucide-react";
import { GlobalSearch } from "@/components/layout/global-search";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, formatDistanceToNow } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { Locale } from "@/i18n/config";
import { useNotifications, getNotificationStyle, Notification } from "@/hooks/useNotifications";

interface HeaderProps {
  onMenuClick?: () => void;
}

// Helper function to get icon component based on notification type
function NotificationIcon({ type }: { type: string }) {
  const style = getNotificationStyle(type);

  switch (style.icon) {
    case 'clock':
      return <Clock className="h-4 w-4" />;
    case 'user':
      return <User className="h-4 w-4" />;
    case 'alert':
      return <AlertTriangle className="h-4 w-4" />;
    case 'check':
      return <CheckCircle className="h-4 w-4" />;
    case 'bell':
      return <Bell className="h-4 w-4" />;
    case 'comment':
      return <MessageSquare className="h-4 w-4" />;
    case 'send-back':
      return <RotateCcw className="h-4 w-4" />;
    default:
      return <Info className="h-4 w-4" />;
  }
}

export function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { locale, setLocale, t, locales, localeNames, localeFlags } = useLanguage();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // Notifications hook
  const {
    notifications,
    unreadCount,
    isLoading: notificationsLoading,
    markAsRead,
    markAllAsRead,
  } = useNotifications({
    autoFetch: true,
    pollingInterval: 60000, // Poll every minute
    limit: 10,
  });

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    // Navigate to the link if provided
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

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="lg:hidden text-slate-500 hover:text-slate-700 hover:bg-slate-100"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Logo - visible on mobile */}
        <Link
          href={session?.user?.roles?.includes("GRCAdministrator") ? "/grc" : "/dashboard"}
          className="flex items-center gap-2 lg:hidden"
        >
          <img src="/logo 3.png" alt="GRC Platform" className="h-8 w-8 object-contain" />
        </Link>

        {/* Date and Time */}
        <div className="hidden md:flex items-center gap-6 ms-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
            <Calendar className="h-4 w-4 text-primary-500" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">{t("Date")}</span>
              <span className="text-sm text-slate-700 font-semibold">
                {currentTime ? format(currentTime, "dd MMM yyyy") : "--"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
            <Clock className="h-4 w-4 text-primary-500" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">{t("Time")}</span>
              <span className="text-sm text-slate-700 font-semibold">
                {currentTime ? format(currentTime, "h:mm a") : "--"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Global Search */}
        <GlobalSearch />

        {/* Language Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:flex items-center gap-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 px-3"
            >
              <Globe className="h-4 w-4" />
              <span className="text-sm font-medium">{locale.toUpperCase()}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {locales.map((loc) => (
              <DropdownMenuItem
                key={loc}
                className="flex items-center justify-between gap-2 cursor-pointer"
                onClick={() => setLocale(loc as Locale)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{localeFlags[loc as Locale]}</span>
                  <span>{localeNames[loc as Locale]}</span>
                </div>
                {locale === loc && <Check className="h-4 w-4 text-primary-500" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 ltr:-right-0.5 rtl:-left-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between py-2">
              <span className="text-sm font-semibold text-slate-800">{t("Notifications")}</span>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    className="text-xs text-slate-500 hover:text-primary-600 transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      markAllAsRead();
                    }}
                  >
                    {t("Mark all read")}
                  </button>
                )}
                <button
                  className="text-xs text-primary-600 hover:text-primary-700 hover:underline transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push('/notifications');
                  }}
                >
                  {t("View all")}
                </button>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-80 overflow-y-auto">
              {notificationsLoading ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  {t("Loading...")}
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <Bell className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">{t("No notifications")}</p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const style = getNotificationStyle(notification.type);
                  return (
                    <DropdownMenuItem
                      key={notification.id}
                      className={`flex flex-col items-start gap-1.5 py-3 px-4 cursor-pointer ${
                        !notification.isRead ? 'bg-primary-50/50' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3 w-full">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.bgColor} ${style.textColor}`}>
                          <NotificationIcon type={notification.type} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium text-slate-800 ${!notification.isRead ? 'font-semibold' : ''}`}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notification.message}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {formatNotificationTime(notification.createdAt)}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <div className="h-2 w-2 rounded-full bg-primary-500 shrink-0 mt-2" />
                        )}
                      </div>
                    </DropdownMenuItem>
                  );
                })
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Divider */}
        <div className="hidden lg:block h-8 w-px bg-slate-200 mx-2" />

        {/* User section */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-3 ps-2 pe-3 py-2 h-auto hover:bg-slate-100 rounded-lg"
            >
              <Avatar className="h-9 w-9 border-2 border-primary-200">
                <AvatarFallback className="bg-gradient-to-br from-primary-500 to-primary-600 text-white text-sm font-semibold">
                  {session?.user?.name ? getInitials(session.user.name) : "U"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden lg:flex flex-col items-start">
                <span className="text-sm font-semibold text-slate-800">
                  {session?.user?.name || t("User")}
                </span>
                <span className="text-xs text-slate-500">
                  {session?.user?.roles?.[0]?.replace(/([A-Z])/g, ' $1').trim() || t("User")}
                </span>
              </div>
              <ChevronDown className="hidden lg:block h-4 w-4 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="py-3">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold text-slate-800">{session?.user?.name || t("User")}</p>
                <p className="text-xs text-slate-500">{session?.user?.email || ""}</p>
                {session?.user?.customerAccountName && (
                  <p className="text-xs text-primary-600 font-medium">{session.user.customerAccountName}</p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="py-2.5 cursor-pointer">
              <User className="me-3 h-4 w-4 text-slate-500" />
              <span className="text-sm">{t("Profile")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="py-2.5 cursor-pointer">
              <Settings className="me-3 h-4 w-4 text-slate-500" />
              <span className="text-sm">{t("Settings")}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="py-2.5 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
              <Link href="/login">
                <LogOut className="me-3 h-4 w-4" />
                <span className="text-sm font-medium">{t("Log out")}</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

// Breadcrumb component to be used in pages
interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const { t, isRTL } = useLanguage();

  return (
    <div className="flex items-center gap-3 text-sm mb-6">
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors"
      >
        <ChevronLeft className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
        <span className="font-medium">{t("Back")}</span>
      </button>
      <div className="h-5 w-px bg-slate-200" />
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-3">
          {index > 0 && <span className="text-slate-300">/</span>}
          {item.href ? (
            <Link
              href={item.href}
              className="text-slate-500 hover:text-slate-700 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-primary-600 font-semibold">{item.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}
