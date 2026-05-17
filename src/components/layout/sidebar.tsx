"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ChevronDown, LogOut, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { navigation, filterNavigationByPermissionsAndRole, type NavItem } from "@/lib/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLogo } from "@/contexts/LogoContext";
import { useModule } from "@/contexts/ModuleContext";
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

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}

interface NavItemComponentProps {
  item: NavItem;
  depth?: number;
  collapsed?: boolean;
  onNavigate?: () => void;
  onExpand?: () => void;
  onLogoutClick?: () => void;
}

function NavItemComponent({ item, depth = 0, collapsed = false, onNavigate, onExpand, onLogoutClick }: NavItemComponentProps) {
  const pathname = usePathname();
  const { t, isRTL } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const hasActiveChild = item.children?.some(
    (child) => child.href && pathname.startsWith(child.href)
  );

  useEffect(() => {
    if (hasActiveChild) {
      setIsOpen(true);
    }
  }, [hasActiveChild]);

  const isActive = item.href === pathname;
  const hasChildren = item.children && item.children.length > 0;
  const Icon = item.icon;
  const translatedName = t(item.name);

  // ===== COLLAPSED MODE (desktop, top-level only) =====
  if (collapsed && depth === 0) {
    if (item.name === "Log Out") {
      return (
        <div className="flex justify-center mb-1 px-2">
          <button
            onClick={() => onLogoutClick?.()}
            title={translatedName}
            className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      );
    }

    if (hasChildren) {
      return (
        <div className="flex justify-center mb-1 px-2">
          <button
            onClick={() => onExpand?.()}
            title={translatedName}
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-lg",
              hasActiveChild
                ? "bg-primary-100 text-primary-600"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            )}
          >
            {Icon && <Icon className="h-[18px] w-[18px]" />}
          </button>
        </div>
      );
    }

    return (
      <div className="flex justify-center mb-1 px-2">
        <Link
          href={item.href || "#"}
          title={translatedName}
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-lg",
            isActive
              ? "bg-primary-100 text-primary-600"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          {Icon && <Icon className="h-[18px] w-[18px]" />}
        </Link>
      </div>
    );
  }

  // ===== EXPANDED MODE =====

  if (hasChildren) {
    return (
      <div className="px-3 mb-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
            "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
            (isOpen || hasActiveChild) && "text-slate-900 bg-slate-50",
            isRTL && "flex-row-reverse"
          )}
        >
          {Icon && (
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
              (isOpen || hasActiveChild) ? "bg-primary-100 text-primary-600" : "bg-slate-100 text-slate-500"
            )}>
              <Icon className="h-[18px] w-[18px]" />
            </div>
          )}
          <span className="flex-1 text-start">{translatedName}</span>
          <ChevronDown className={cn(
            "h-4 w-4 text-slate-400 transition-transform duration-200",
            isOpen && "rotate-180"
          )} />
        </button>
        <div className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}>
          <div className="mt-1 ms-[22px] ps-4 border-s-2 border-slate-200">
            {item.children?.map((child) => (
              <NavItemComponent key={child.name} item={child} depth={depth + 1} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (item.name === "Log Out") {
    return (
      <div className="px-3 mb-1">
        <button
          onClick={() => onLogoutClick?.()}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
            "text-slate-500 hover:text-red-600 hover:bg-red-50",
            isRTL && "flex-row-reverse"
          )}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-500 group-hover:bg-red-50 group-hover:text-red-500">
            <LogOut className="h-[18px] w-[18px]" />
          </div>
          <span>{translatedName}</span>
        </button>
      </div>
    );
  }

  // Child items (depth > 0)
  if (depth > 0) {
    return (
      <Link
        href={item.href || "#"}
        onClick={() => onNavigate?.()}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium transition-all duration-200 my-0.5",
          "text-slate-500 hover:text-slate-900 hover:bg-slate-100",
          isActive && "text-primary-600 bg-primary-50 hover:bg-primary-100",
          isRTL && "flex-row-reverse"
        )}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        <span>{translatedName}</span>
      </Link>
    );
  }

  // Top-level items without children
  return (
    <div className="px-3 mb-1">
      <Link
        href={item.href || "#"}
        onClick={() => onNavigate?.()}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
          "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
          isActive && "text-primary-700 bg-primary-50",
          isRTL && "flex-row-reverse"
        )}
      >
        {Icon && (
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
            isActive ? "bg-primary-100 text-primary-600" : "bg-slate-100 text-slate-500"
          )}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
        )}
        <span>{translatedName}</span>
      </Link>
    </div>
  );
}

export function Sidebar({ collapsed = false, onToggleCollapse, onNavigate }: SidebarProps) {
  const { data: session, status } = useSession();
  const { t, isRTL } = useLanguage();
  const { logoUrl } = useLogo();
  const { currentModule, availableModules, isSystemUser } = useModule();
  const router = useRouter();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const filteredNavigation = useMemo(() => {
    if (!session?.user?.permissions || !session?.user?.roles) {
      return [];
    }

    return filterNavigationByPermissionsAndRole(
      navigation,
      session.user.permissions,
      session.user.roles,
      {
        isGrcAdded: session.user.isGrcAdded ?? false,
        isTprmAdded: session.user.isTprmAdded ?? false,
        isInternalAuditEnabled: session.user.isInternalAuditEnabled ?? false,
        isTechnicalEvidenceEnabled: session.user.isTechnicalEvidenceEnabled ?? false,
        isQpostComplianceEnabled: session.user.isQpostComplianceEnabled ?? false,
      },
      currentModule,
    );
  }, [session?.user?.permissions, session?.user?.roles, session?.user?.isGrcAdded, session?.user?.isTprmAdded, session?.user?.isInternalAuditEnabled, session?.user?.isTechnicalEvidenceEnabled, session?.user?.isQpostComplianceEnabled, currentModule]);

  // "Switch workspace" button only useful when the user has 2+ modules.
  const canSwitchWorkspace = !isSystemUser && availableModules.length >= 2;

  // Module scoping (navigation.ts) only kicks in once currentModule is known.
  // On a fresh page load currentModule hydrates from cookie one tick after the
  // session is ready — during that gap the nav would be rendered unscoped,
  // showing every module's sections (e.g. duplicate "Organization" entries).
  // Hold the nav behind the loading state until scoping is resolved.
  const moduleScopePending =
    !isSystemUser && availableModules.length > 0 && currentModule === null;

  // Platform logo / label — three of the four platforms ship a dedicated
  // Glimmora-suffixed wordmark image (GRC / TPRM / Internal Audit). Technical
  // Evidence has no dedicated wordmark, so the sidebar shows plain text instead.
  const hasPlatformLogo =
    currentModule === "GRC" || currentModule === "TPRM" || currentModule === "INTERNAL_AUDIT";
  const platformLogoSrc =
    currentModule === "GRC" ? "/logo-grc.png"
    : currentModule === "TPRM" ? "/logo-tprm.png"
    : currentModule === "INTERNAL_AUDIT" ? "/logo-internal-audit.png"
    : "/logo.png";
  const platformLogoAlt =
    currentModule === "GRC" ? "Glimmora GRC"
    : currentModule === "TPRM" ? "Glimmora TPRM"
    : currentModule === "INTERNAL_AUDIT" ? "Glimmora Internal Audit"
    : "Glimmora VerifAI";
  // Text-only fallback label (used when no image-wordmark is available).
  const platformTextLabel =
    currentModule === "TECHNICAL_EVIDENCE" ? t("Verifai Technical Evidence")
    : t("Verifai");

  return (
    <aside
      className={cn(
        "fixed top-0 z-40 h-screen bg-white ltr:left-0 ltr:border-r rtl:right-0 rtl:border-l border-slate-200 overflow-hidden",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Logo area — taller container (h-20) so the wordmark + subtitle inside
          each platform logo reads clearly. */}
      <div
        className={cn(
          "relative flex h-20 items-center border-b border-slate-200",
          collapsed ? "justify-center px-2" : "gap-3 px-5"
        )}
      >
        <Link
          href={
            session?.user?.roles?.includes("GRCAdministrator") ? "/grc"
              : session?.user?.isTprmAdded && !session?.user?.isGrcAdded ? "/tprm/program-monitor"
              : "/dashboard"
          }
          className="flex items-center gap-3 group shrink-0"
        >
          {/* Logo: customer's uploaded logo if set, otherwise the default platform mark.
              Both modes show the brand label next to the logo (per BA spec). */}
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={session?.user?.customerAccountName || "Logo"}
              className={collapsed ? "h-9 w-9 rounded object-cover shrink-0" : "h-9 w-9 rounded object-cover shrink-0"}
            />
          ) : collapsed ? (
            // Collapsed sidebar: show only the G icon, cropped from the wide
            // Glimmora wordmark via CSS background trick. backgroundSize zooms
            // in so the G fills the box; backgroundPosition aligns to the left
            // edge where the G sits in the source image. The image swaps per
            // workspace; for TE we use the default /logo.png since TE has no
            // dedicated wordmark. The 220% zoom (was 240%) gives the G a touch
            // more breathing room inside the 36×36 box.
            // TODO: swap for a dedicated <img src="/logo-icon.png"> when exported.
            <div
              role="img"
              aria-label={platformLogoAlt}
              className="h-9 w-9 shrink-0 bg-no-repeat"
              style={{
                backgroundImage: `url(${hasPlatformLogo ? platformLogoSrc : "/logo.png"})`,
                backgroundSize: "auto 220%",
                backgroundPosition: "8% 50%",
              }}
            />
          ) : hasPlatformLogo ? (
            // Expanded sidebar with a dedicated wordmark image — render at h-16
            // so the platform subtitle inside the logo (e.g. "Internal Audit")
            // is clearly readable.
            <img src={platformLogoSrc} alt={platformLogoAlt} className="h-16 w-auto max-w-[230px] object-contain shrink-0" />
          ) : (
            // Expanded sidebar, no dedicated wordmark (TE or default fallback) —
            // show a plain text label instead of an unrelated logo.
            <span className="text-base font-semibold text-slate-800 tracking-tight whitespace-nowrap">
              {platformTextLabel}
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className={collapsed ? "h-[calc(100vh-80px)] pt-2" : "h-[calc(100vh-136px)] pt-2"}>
        <nav className="pb-4">
          {/* Switch workspace — multi-module users only */}
          {canSwitchWorkspace && (
            collapsed ? (
              <div className="flex justify-center mb-2 px-2">
                <button
                  onClick={() => router.push("/select-module")}
                  title={t("Switch workspace")}
                  className="flex items-center justify-center w-10 h-10 rounded-lg text-primary-600 hover:bg-primary-50"
                >
                  <ArrowLeftRight className="h-[18px] w-[18px]" />
                </button>
              </div>
            ) : (
              <div className="px-3 mb-2">
                <button
                  onClick={() => router.push("/select-module")}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    "text-primary-700 bg-primary-50 hover:bg-primary-100",
                    isRTL && "flex-row-reverse",
                  )}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white text-primary-600">
                    <ArrowLeftRight className="h-[18px] w-[18px]" />
                  </div>
                  <span>{t("Switch workspace")}</span>
                </button>
              </div>
            )
          )}
          {status === "loading" || moduleScopePending ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent"></div>
              {!collapsed && <span className="text-xs text-slate-400">{t("Loading...")}</span>}
            </div>
          ) : (
            filteredNavigation.map((item) => (
              <NavItemComponent
                key={item.module ? `${item.module}:${item.name}` : item.name}
                item={item}
                collapsed={collapsed}
                onNavigate={onNavigate}
                onExpand={onToggleCollapse}
                onLogoutClick={() => setShowLogoutDialog(true)}
              />
            ))
          )}
        </nav>
      </ScrollArea>

      {/* Footer — hidden when collapsed */}
      {!collapsed && (
        <div className="absolute bottom-0 inset-x-0 p-4 border-t border-slate-200 bg-white">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>© 2025 {session?.user?.customerAccountName || "Glimmora"}</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{t("v2.0")}</span>
          </div>
        </div>
      )}

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent className={isRTL ? "text-right" : ""}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Confirm Logout")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to log out? You will need to sign in again to access the application.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isRTL ? "flex-row-reverse gap-2" : ""}>
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
    </aside>
  );
}
