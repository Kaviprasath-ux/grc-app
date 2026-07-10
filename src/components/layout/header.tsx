"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Bell, Menu, ChevronDown, LogOut, User, Calendar, Clock, ChevronLeft, Globe, Check, AlertTriangle, CheckCircle, Info, MessageSquare, RotateCcw, PanelLeftClose, PanelLeftOpen, MessageCircleQuestion, Palette, X, Eye, EyeOff, Loader2 } from "lucide-react";
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
import { ar, lv, enUS } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { Locale } from "@/i18n/config";
import { useNotifications, getNotificationStyle, Notification } from "@/hooks/useNotifications";
import { useTheme } from "@/contexts/ThemeContext";
import { useLogo } from "@/contexts/LogoContext";
import { useHasRole } from "@/hooks/usePermissions";
import { useTranslatedRecord } from "@/hooks/useTranslatedData";
import { useModule } from "@/contexts/ModuleContext";
import { getModulesForRole } from "@/lib/role-module-map";
import { getRoleDisplayName, type RoleName } from "@/lib/permissions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const dateFnsLocales: Record<string, typeof enUS> = { en: enUS, ar, lv };

/**
 * Rewrite a stored notification link so its TPRM role-prefix matches the
 * page the user actually has permission to view.
 *
 * Background: notification helpers in src/lib/notification-service.ts store
 * a hardcoded role-prefixed URL (e.g. `/tprm/asr-assessments/<id>`). When
 * the clicking user holds a different role than the helper assumed — for
 * example a Relationship Manager receiving an "Assessment approved"
 * notification whose stored link is the assessor-side URL — clicking
 * routes them to a page they can't view, producing an "Assessment not
 * found" dead-end.
 *
 * The rewrite below handles `/tprm/(am|asr|bo|rm)-assessments/<id>` and
 * picks the right destination for the user's strongest available role.
 *
 * Role priority for the assessment page (best access first):
 *   Reviewer (Assessor / Approver / Auditor) → /tprm/asr-assessments/<id>
 *   AccountManager                            → /tprm/am-assessments/<id>
 *   RelationshipManager                       → /tprm/rm-assessments
 *   BusinessOwner                             → /tprm/bo-assessments
 *
 * RM and BO have list-only pages (no per-assessment detail), so the
 * `<id>` segment is dropped for those — the user lands on the list where
 * they can locate the assessment in question manually. This is the
 * least-bad fallback for "no detail page exists for this role" and
 * matches the sidebar's Assessments entry for those roles.
 *
 * Multi-role users keep the existing prefix when it already matches one
 * of their roles. Users with none of the four prefixes (e.g. plain
 * CustomerAdministrator with no TPRM-specific role) get the link
 * unchanged — they typically have global tprm.* permissions and the
 * page renders fine.
 */
function rewriteTprmNotificationLink(link: string, roles: string[]): string {
  const match = link.match(/^\/tprm\/(am|asr|bo|rm)-assessments\/([^?#]+)(.*)$/);
  if (!match) return link;
  const [, currentPrefix, idAndTail, query] = match;

  const isReviewer =
    roles.includes("TPRMAssessor") ||
    roles.includes("TPRMApprover") ||
    roles.includes("TPRMAuditor");
  const isAM = roles.includes("AccountManager");
  const isRM = roles.includes("RelationshipManager");
  const isBO = roles.includes("BusinessOwner");

  // Multi-role users: if the link's prefix already matches a role they hold,
  // keep the link verbatim — they have the strongest possible access already.
  if (currentPrefix === "asr" && isReviewer) return link;
  if (currentPrefix === "am" && isAM) return link;
  if (currentPrefix === "rm" && isRM) return link;
  if (currentPrefix === "bo" && isBO) return link;

  // Otherwise pick the best destination for the strongest role the user has.
  // Reviewer roles win because their detail page carries the most context.
  if (isReviewer) {
    return `/tprm/asr-assessments/${idAndTail}${query}`;
  }
  if (isAM) {
    return `/tprm/am-assessments/${idAndTail}${query}`;
  }
  // RM and BO: no per-assessment detail page exists. Drop the id segment
  // and send the user to their assessment list rather than a 404.
  if (isRM) {
    return `/tprm/rm-assessments`;
  }
  if (isBO) {
    return `/tprm/bo-assessments`;
  }

  // No TPRM-specific role we recognise (e.g. plain CustomerAdministrator).
  // Leave the link as the helper wrote it — those users typically have
  // global tprm.* access and the page will render normally.
  return link;
}

interface HeaderProps {
  onMenuClick?: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  helpOpen?: boolean;
  onHelpToggle?: () => void;
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

export function Header({ onMenuClick, sidebarCollapsed, onToggleSidebar, helpOpen, onHelpToggle }: HeaderProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { locale, setLocale, t, locales, localeNames, localeFlags } = useLanguage();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState({ fullName: "", email: "", designation: "", department: "", company: "" });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const { toast } = useToast();
  const dateFnsLocale = dateFnsLocales[locale] || enUS;

  // Theme (only for CustomerAdministrator)
  const { theme, setTheme, themeOptions } = useTheme();
  const isCustomerAdmin = useHasRole("CustomerAdministrator");
  const { logoUrl } = useLogo();

  // Translate current user name
  const userRecord = session?.user?.id ? { id: session.user.id, fullName: session.user.name || "" } : null;
  const { data: translatedUser } = useTranslatedRecord(userRecord, { modelName: 'User' });
  const displayName = translatedUser?.fullName || session?.user?.name || t("User");

  // Phase 9 — show the role for the CURRENT workspace, not just the first
  // entry in roles[]. A multi-module user (e.g. aman: DepartmentReviewer/GRC
  // + BusinessOwner/TPRM) should see "Business Owner" while inside the TPRM
  // workspace, not "Department Reviewer".
  const { currentModule } = useModule();
  const sessionRoles = (session?.user?.roles ?? []) as RoleName[];
  const roleForModule = (() => {
    if (!sessionRoles.length) return "";
    // System users (GRCAdministrator etc.) have no currentModule — show as-is.
    if (!currentModule) return sessionRoles[0];
    const matches = sessionRoles.filter((r) => {
      const mods = (() => {
        try { return getModulesForRole(r); } catch { return null; }
      })();
      if (!mods) return false;
      if (mods === "system") return true;
      return Array.isArray(mods) && mods.includes(currentModule);
    });
    // Prefer non-CustomerAdministrator (the specific role label is more useful)
    return matches.find((r) => r !== "CustomerAdministrator") || matches[0] || sessionRoles[0];
  })();
  const rawRole = getRoleDisplayName(roleForModule)
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  const displayRole = rawRole ? t(rawRole) : t("User");

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
    // Scope the bell + unread badge to the workspace the user is currently in.
    module: currentModule,
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

  // Profile modal handlers
  const openProfileModal = async () => {
    setShowProfileModal(true);
    setShowChangePassword(false);
    setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setProfileLoading(true);
    try {
      const res = await fetch("/api/users/me");
      if (res.ok) {
        const data = await res.json();
        setProfileData({
          fullName: data.fullName || "",
          email: data.email || "",
          designation: data.designation || "",
          department: data.department?.name || "",
          company: data.customerAccount?.name || "",
        });
      }
    } catch { /* ignore */ } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    setProfileSaving(true);
    try {
      const payload: Record<string, string> = { fullName: profileData.fullName, email: profileData.email };
      if (showChangePassword && passwordData.newPassword) {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
          toast({ title: t("Passwords do not match"), variant: "destructive" });
          setProfileSaving(false);
          return;
        }
        payload.currentPassword = passwordData.currentPassword;
        payload.newPassword = passwordData.newPassword;
      }
      const res = await fetch("/api/users/me", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        toast({ title: t("Profile updated successfully") });
        setShowProfileModal(false);
        setShowChangePassword(false);
      } else {
        const err = await res.json();
        toast({ title: err.error || t("Failed to update profile"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Failed to update profile"), variant: "destructive" });
    } finally {
      setProfileSaving(false);
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    // Navigate to the linked page. Notification links are stored with the
    // role-prefix that was correct for the original recipient (e.g. an AM
    // gets `/tprm/am-assessments/<id>`, an Assessor gets `/tprm/asr-...`).
    // For historical notifications and any helper that picked the wrong
    // prefix, rewrite the prefix to the one this user actually has access
    // to before navigating — otherwise they hit a 403 or empty page.
    if (notification.link) {
      const roles = (session?.user?.roles as string[] | undefined) ?? [];
      router.push(rewriteTprmNotificationLink(notification.link, roles));
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
        {/* Mobile / Tablet menu button — below xl */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="xl:hidden text-slate-500 hover:text-slate-700 hover:bg-slate-100"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Desktop sidebar toggle — xl+ only */}
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="hidden xl:flex text-slate-500 hover:text-slate-700 hover:bg-slate-100"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-5 w-5 rtl:scale-x-[-1]" />
            ) : (
              <PanelLeftClose className="h-5 w-5 rtl:scale-x-[-1]" />
            )}
          </Button>
        )}

        {/* Logo — visible below xl */}
        <Link
          href={session?.user?.roles?.includes("GRCAdministrator") ? "/grc" : "/dashboard"}
          className="flex items-center gap-2 xl:hidden"
        >
          {logoUrl ? (
            <img src={logoUrl} alt={session?.user?.customerAccountName || "Logo"} className="h-10 max-w-[180px] object-contain" />
          ) : currentModule === "GRC" || currentModule === "TPRM" || currentModule === "INTERNAL_AUDIT" ? (
            <img
              src={
                currentModule === "GRC" ? "/logo-grc.png"
                : currentModule === "TPRM" ? "/logo-tprm.png"
                : "/logo-internal-audit.png"
              }
              alt={
                currentModule === "GRC" ? "Glimmora GRC"
                : currentModule === "TPRM" ? "Glimmora TPRM"
                : "Glimmora Internal Audit"
              }
              className="h-10 w-auto max-w-[180px] object-contain"
            />
          ) : (
            // Technical Evidence + default fallback — no dedicated wordmark
            // image, show short brand text instead.
            <span className="text-sm font-semibold text-slate-800 tracking-tight whitespace-nowrap">
              {currentModule === "TECHNICAL_EVIDENCE" ? t("Verifai Technical Evidence") : t("Verifai")}
            </span>
          )}
        </Link>

        {/* Date and Time — compact form (icon + value only) at xl+, full labels at ultra-wide */}
        <div className="hidden xl:flex items-center gap-2 ms-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
            <Calendar className="h-4 w-4 text-primary-500" />
            <span className="hidden min-[1700px]:inline text-xs text-slate-500 font-medium">{t("Date")}</span>
            <span className="text-xs text-slate-700 font-semibold whitespace-nowrap">
              {currentTime ? format(currentTime, "dd MMM yyyy", { locale: dateFnsLocale }) : "--"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
            <Clock className="h-4 w-4 text-primary-500" />
            <span className="hidden min-[1700px]:inline text-xs text-slate-500 font-medium">{t("Time")}</span>
            <span className="text-xs text-slate-700 font-semibold whitespace-nowrap">
              {currentTime ? format(currentTime, "h:mm a", { locale: dateFnsLocale }) : "--"}
            </span>
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1.5">
        {/* Global Search */}
        <div className="lg:ms-2">
          <GlobalSearch />
        </div>

        {/* Theme Picker — Customer Administrator only */}
        {isCustomerAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="hidden md:flex items-center gap-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 px-2"
                title={t("Color Theme")}
              >
                <Palette className="h-4 w-4" />
                <span
                  className="h-3.5 w-3.5 rounded-full border border-slate-300"
                  style={{ backgroundColor: themeOptions.find(o => o.id === theme)?.color || "#A57865" }}
                />
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 max-h-72 overflow-y-auto">
              <DropdownMenuLabel className="text-xs text-slate-500 font-medium">
                {t("Color Theme")}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {themeOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.id}
                  className="flex items-center justify-between gap-2 cursor-pointer"
                  onClick={() => setTheme(opt.id)}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-4 w-4 rounded-full border border-slate-200"
                      style={{ backgroundColor: opt.color }}
                    />
                    <span className="text-sm">{t(opt.name)}</span>
                  </div>
                  {theme === opt.id && <Check className="h-4 w-4 text-primary-500" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Language Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:flex items-center gap-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 px-3"
              title={t("Language")}
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

        {/* Help Assistant */}
        {onHelpToggle && (
          <Button
            variant="ghost"
            onClick={onHelpToggle}
            className={`relative flex items-center gap-1.5 px-2.5 h-9 rounded-full transition-all ${
              helpOpen
                ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 shadow-sm"
                : "bg-gradient-to-r from-primary-50 to-primary-100 text-primary-700 hover:from-primary-100 hover:to-primary-200 border border-primary-200"
            }`}
            title={`${t("AI Chat & Voice Bot")} (F1)`}
          >
            <MessageCircleQuestion className="h-4 w-4" />
            <span className="text-xs font-semibold hidden min-[1700px]:inline">{t("AI Chat & Voice Bot")}</span>
          </Button>
        )}

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              title={t("Notifications")}
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
                  className="text-xs text-primary-600 hover:text-primary-700 cursor-pointer transition-colors"
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
        <div className="hidden xl:block h-8 w-px bg-slate-200 mx-2" />

        {/* User section */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 ps-1.5 pe-2 py-2 h-auto hover:bg-slate-100 rounded-lg"
            >
              <Avatar className="h-9 w-9 border-2 border-primary-200">
                <AvatarFallback className="bg-gradient-to-br from-primary-500 to-primary-600 text-white text-sm font-semibold">
                  {session?.user?.name ? getInitials(session.user.name) : "U"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden xl:flex flex-col items-start max-w-[200px]">
                <span className="text-sm font-semibold text-slate-800 truncate max-w-full">
                  {displayName}
                </span>
                <span className="text-xs text-slate-500 truncate max-w-full whitespace-nowrap">
                  {displayRole}
                </span>
              </div>
              <ChevronDown className="hidden xl:block h-4 w-4 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="py-3">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold text-slate-800">{displayName}</p>
                <p className="text-xs text-slate-500">{session?.user?.email || ""}</p>
                {session?.user?.customerAccountName && (
                  <p className="text-xs text-primary-600 font-medium">{session.user.customerAccountName}</p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="py-2.5 cursor-pointer" onClick={openProfileModal}>
              <User className="me-3 h-4 w-4 text-slate-500" />
              <span className="text-sm">{t("Profile")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="py-2.5 cursor-pointer">
              <Link href="/notifications">
                <Bell className="me-3 h-4 w-4 text-slate-500" />
                <span className="text-sm">{t("Notifications")}</span>
                {unreadCount > 0 && (
                  <span className="ltr:ml-auto rtl:mr-auto text-[10px] font-medium bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="py-2.5 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
              onClick={() => setShowLogoutDialog(true)}
            >
              <LogOut className="me-3 h-4 w-4" />
              <span className="text-sm font-medium">{t("Log out")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent className={locale === "ar" ? "text-right" : ""}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Confirm Logout")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to log out? You will need to sign in again to access the application.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={locale === "ar" ? "flex-row-reverse gap-2" : ""}>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              onClick={async () => { await signOut({ redirect: false }); window.location.href = "/login"; }}
            >
              {t("Log out")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Profile Modal */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Profile")}</DialogTitle>
          </DialogHeader>
          {profileLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Avatar */}
              <div className="flex justify-center">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-primary-100">
                  {profileData.fullName ? getInitials(profileData.fullName) : "U"}
                </div>
              </div>

              {/* Full Name */}
              <div className="space-y-1.5">
                <Label>{t("Full Name")}</Label>
                <Input value={profileData.fullName} onChange={(e) => setProfileData(p => ({ ...p, fullName: e.target.value }))} />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label>{t("Email")}</Label>
                <Input value={profileData.email} onChange={(e) => setProfileData(p => ({ ...p, email: e.target.value }))} />
              </div>

              {/* Company (read-only) */}
              {profileData.company && (
                <div className="space-y-1.5">
                  <Label>{t("Company Name")}</Label>
                  <Input value={profileData.company} disabled className="bg-slate-50" />
                </div>
              )}

              {/* Department (read-only) */}
              {profileData.department && (
                <div className="space-y-1.5">
                  <Label>{t("Department")}</Label>
                  <Input value={profileData.department} disabled className="bg-slate-50" />
                </div>
              )}

              {/* Designation (read-only) */}
              {profileData.designation && (
                <div className="space-y-1.5">
                  <Label>{t("Designation")}</Label>
                  <Input value={profileData.designation} disabled className="bg-slate-50" />
                </div>
              )}

              {/* Change Password Toggle */}
              {!showChangePassword ? (
                <Button variant="outline" size="sm" className="text-primary-600 border-primary-200" onClick={() => setShowChangePassword(true)}>
                  {t("Change Password")}
                </Button>
              ) : (
                <div className="space-y-3 border rounded-lg p-4 bg-slate-50">
                  <h4 className="text-sm font-semibold">{t("Change Password")}</h4>
                  <div className="space-y-1.5">
                    <Label>{t("Current Password")}</Label>
                    <div className="relative">
                      <Input
                        type={showCurrentPw ? "text" : "password"}
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData(p => ({ ...p, currentPassword: e.target.value }))}
                      />
                      <button type="button" className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowCurrentPw(!showCurrentPw)}>
                        {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("New Password")}</Label>
                    <div className="relative">
                      <Input
                        type={showNewPw ? "text" : "password"}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData(p => ({ ...p, newPassword: e.target.value }))}
                      />
                      <button type="button" className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowNewPw(!showNewPw)}>
                        {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("Confirm Password")}</Label>
                    <Input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(p => ({ ...p, confirmPassword: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowProfileModal(false)}>{t("Close")}</Button>
                <Button onClick={handleUpdateProfile} disabled={profileSaving} className="bg-primary-600 hover:bg-primary-700 text-white">
                  {profileSaving && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
                  {t("Update Profile")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
