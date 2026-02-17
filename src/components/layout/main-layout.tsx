"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isRTL } = useLanguage();

  // Load sidebar preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") {
      setSidebarCollapsed(true);
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }, []);

  // Close mobile sheet when a nav link is clicked
  const handleMobileNavigate = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-surface-secondary overflow-x-hidden">
      {/* Desktop Sidebar — visible at xl (1280px+) */}
      <div className="hidden xl:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
      </div>

      {/* Mobile / Tablet Sidebar — Sheet overlay below xl */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side={isRTL ? "right" : "left"} className="w-[260px] p-0 bg-white">
          <Sidebar onNavigate={handleMobileNavigate} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div
        className={cn(
          "min-h-screen flex flex-col",
          sidebarCollapsed
            ? "ltr:xl:pl-[72px] rtl:xl:pr-[72px]"
            : "ltr:xl:pl-[260px] rtl:xl:pr-[260px]"
        )}
      >
        <Header
          onMenuClick={() => setMobileMenuOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
        />
        <main className="flex-1 p-4 lg:p-6 min-w-0">{children}</main>
      </div>
    </div>
  );
}
