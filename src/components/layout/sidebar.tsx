"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ChevronDown, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { navigation, filterNavigationByPermissionsAndRole, type NavItem } from "@/lib/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NavItemProps {
  item: NavItem;
  depth?: number;
}

function NavItemComponent({ item, depth = 0 }: NavItemProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Check if any child is active
  const hasActiveChild = item.children?.some(
    (child) => child.href && pathname.startsWith(child.href)
  );

  // Auto-expand if has active child
  useEffect(() => {
    if (hasActiveChild) {
      setIsOpen(true);
    }
  }, [hasActiveChild]);

  const isActive = item.href === pathname;
  const hasChildren = item.children && item.children.length > 0;
  const Icon = item.icon;

  if (hasChildren) {
    return (
      <div className="px-3 mb-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
            "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
            (isOpen || hasActiveChild) && "text-slate-900 bg-slate-50"
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
          <span className="flex-1 text-left">{item.name}</span>
          <ChevronDown className={cn(
            "h-4 w-4 text-slate-400 transition-transform duration-200",
            isOpen && "rotate-180"
          )} />
        </button>
        <div className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}>
          <div className="mt-1 ml-[22px] pl-4 border-l-2 border-slate-200">
            {item.children?.map((child) => (
              <NavItemComponent key={child.name} item={child} depth={depth + 1} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Handle Log Out specially
  if (item.name === "Log Out") {
    return (
      <div className="px-3 mb-1">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
            "text-slate-500 hover:text-red-600 hover:bg-red-50"
          )}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-500 group-hover:bg-red-50 group-hover:text-red-500">
            <LogOut className="h-[18px] w-[18px]" />
          </div>
          <span>{item.name}</span>
        </button>
      </div>
    );
  }

  // Child items (depth > 0)
  if (depth > 0) {
    return (
      <Link
        href={item.href || "#"}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium transition-all duration-200 my-0.5",
          "text-slate-500 hover:text-slate-900 hover:bg-slate-100",
          isActive && "text-primary-600 bg-primary-50 hover:bg-primary-100"
        )}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        <span>{item.name}</span>
      </Link>
    );
  }

  // Top-level items without children
  return (
    <div className="px-3 mb-1">
      <Link
        href={item.href || "#"}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
          "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
          isActive && "text-primary-700 bg-primary-50"
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
        <span>{item.name}</span>
      </Link>
    </div>
  );
}

export function Sidebar() {
  const { data: session, status } = useSession();

  // Filter navigation based on user permissions and transform paths for role
  const filteredNavigation = useMemo(() => {
    if (!session?.user?.permissions || !session?.user?.roles) {
      return [];
    }

    return filterNavigationByPermissionsAndRole(
      navigation,
      session.user.permissions,
      session.user.roles
    );
  }, [session?.user?.permissions, session?.user?.roles]);

  // Determine if user info should be shown
  const showUserInfo = session?.user?.roles && session.user.roles.length > 0;

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[260px] bg-white border-r border-slate-200">
      {/* Logo area */}
      <div className="relative flex h-16 items-center gap-3 border-b border-slate-200 px-5">
        <Link
          href={session?.user?.roles?.includes("GRCAdministrator") ? "/grc" : "/dashboard"}
          className="flex items-center gap-3 group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-500/20">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-white">
              <path fill="currentColor" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold text-slate-800 tracking-tight">GRC Platform</span>
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Enterprise</span>
          </div>
        </Link>
      </div>

      {/* User profile section */}
      {showUserInfo && (
        <div className="relative mx-3 mt-4 mb-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white text-sm font-semibold shadow-md">
              {getInitials(session.user.name || 'U')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-800 truncate">
                {session.user.name}
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {session.user.roles.slice(0, 1).map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-primary-50 text-primary-600 border border-primary-200"
                  >
                    {role.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                ))}
                {session.user.roles.length > 1 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500">
                    +{session.user.roles.length - 1}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation section label */}
      <div className="relative px-5 py-3">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Navigation</span>
      </div>

      {/* Navigation */}
      <ScrollArea className={cn(
        "relative",
        showUserInfo ? "h-[calc(100vh-200px)]" : "h-[calc(100vh-120px)]"
      )}>
        <nav className="pb-4">
          {status === "loading" ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent"></div>
              <span className="text-xs text-slate-400">Loading...</span>
            </div>
          ) : (
            filteredNavigation.map((item) => (
              <NavItemComponent key={item.name} item={item} />
            ))
          )}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200 bg-white">
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>© 2025 GRC Platform</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">v2.0</span>
        </div>
      </div>
    </aside>
  );
}
