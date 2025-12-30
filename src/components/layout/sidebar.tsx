"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { navigation, type NavItem } from "@/lib/navigation";
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
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors",
            "text-white/90 hover:text-white hover:bg-white/10",
            (isOpen || hasActiveChild) && "text-white bg-white/5",
            depth === 0 && "text-[15px]"
          )}
        >
          {Icon && <Icon className="h-5 w-5 shrink-0" />}
          <span className="flex-1 text-left">{item.name}</span>
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        {isOpen && (
          <div className="bg-[#0a1628]">
            {item.children?.map((child) => (
              <NavItemComponent key={child.name} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href || "#"}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors",
        "text-white/80 hover:text-white hover:bg-white/10",
        isActive && "bg-[#1e3a5f] text-white border-l-4 border-blue-400",
        depth > 0 && "pl-12 text-[13px]",
        depth === 0 && "text-[15px]"
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span>{item.name}</span>
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[205px] bg-[#0f2744]">
      {/* Decorative background pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M54.627 0l.83.828-1.415 1.415L51.8 0h2.827zM5.373 0l-.83.828L5.96 2.243 8.2 0H5.374zM48.97 0l3.657 3.657-1.414 1.414L46.143 0h2.828zM11.03 0L7.372 3.657 8.787 5.07 13.857 0H11.03zm32.284 0L49.8 6.485 48.384 7.9l-7.9-7.9h2.83zM16.686 0L10.2 6.485 11.616 7.9l7.9-7.9h-2.83zM22.344 0L13.858 8.485 15.272 9.9l9.9-9.9h-2.83zM32 0l-3.486 3.485-1.414 1.414L32 0zM0 5.373l.828-.83 1.415 1.415L0 8.2V5.374zm0 5.656l.828-.829 5.657 5.657-1.414 1.414L0 11.03v2.828-5.657zm0 5.656l.828-.828 8.485 8.485-1.414 1.414L0 16.686v2.83-5.657zm0 5.657l.828-.828 11.314 11.314-1.414 1.414L0 22.343v2.83-5.656zm0 5.657l.828-.828 14.142 14.142-1.414 1.414L0 28v2.83-5.656z' fill='%23ffffff' fill-opacity='0.4' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Logo area */}
      <div className="relative flex h-16 items-center justify-center border-b border-white/10 px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center">
            <svg viewBox="0 0 40 40" className="h-10 w-10">
              <circle cx="20" cy="20" r="18" fill="#1e40af" />
              <path d="M20 8 L32 20 L20 32 L8 20 Z" fill="#ef4444" />
              <circle cx="20" cy="20" r="6" fill="white" />
            </svg>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="relative h-[calc(100vh-4rem)]">
        <nav className="py-2">
          {navigation.map((item) => (
            <NavItemComponent key={item.name} item={item} />
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
