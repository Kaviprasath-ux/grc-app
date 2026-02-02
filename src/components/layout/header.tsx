"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Bell, Menu, ChevronDown, LogOut, User, Settings, Calendar, Clock, ChevronLeft, Globe, Search, Check } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { locales, localeNames, localeFlags, Locale } from "@/i18n/config";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();
  const { locale, setLocale } = useLanguage();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-white">
              <path fill="currentColor" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
        </Link>

        {/* Date and Time */}
        <div className="hidden md:flex items-center gap-6 ml-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
            <Calendar className="h-4 w-4 text-primary-500" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Date</span>
              <span className="text-sm text-slate-700 font-semibold">
                {currentTime ? format(currentTime, "dd MMM yyyy") : "--"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
            <Clock className="h-4 w-4 text-primary-500" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Time</span>
              <span className="text-sm text-slate-700 font-semibold">
                {currentTime ? format(currentTime, "h:mm a") : "--"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Search button */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex text-slate-500 hover:text-slate-700 hover:bg-slate-100"
        >
          <Search className="h-5 w-5" />
        </Button>

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
                onClick={() => setLocale(loc)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{localeFlags[loc]}</span>
                  <span>{localeNames[loc]}</span>
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
              <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
                3
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between py-3">
              <span className="text-base font-semibold text-slate-800">Notifications</span>
              <Button variant="ghost" size="sm" className="text-xs text-primary-600 hover:text-primary-700 h-auto p-0">
                Mark all read
              </Button>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-80 overflow-y-auto">
              <DropdownMenuItem className="flex flex-col items-start gap-1.5 py-3 px-4 cursor-pointer">
                <div className="flex items-start gap-3 w-full">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">Evidence request due tomorrow</p>
                    <p className="text-xs text-slate-500 mt-0.5">Control: A.5.1.1 - Information Security Policy</p>
                    <p className="text-xs text-slate-400 mt-1">2 hours ago</p>
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start gap-1.5 py-3 px-4 cursor-pointer">
                <div className="flex items-start gap-3 w-full">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">Risk assessment assigned</p>
                    <p className="text-xs text-slate-500 mt-0.5">RSK-045: Data Security Risk</p>
                    <p className="text-xs text-slate-400 mt-1">Yesterday</p>
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start gap-1.5 py-3 px-4 cursor-pointer">
                <div className="flex items-start gap-3 w-full">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">New audit finding created</p>
                    <p className="text-xs text-slate-500 mt-0.5">FND-012: Access Control Gap</p>
                    <p className="text-xs text-slate-400 mt-1">2 days ago</p>
                  </div>
                </div>
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button variant="ghost" className="w-full text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50">
                View all notifications
              </Button>
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
              className="flex items-center gap-3 pl-2 pr-3 py-2 h-auto hover:bg-slate-100 rounded-lg"
            >
              <Avatar className="h-9 w-9 border-2 border-primary-200">
                <AvatarFallback className="bg-gradient-to-br from-primary-500 to-primary-600 text-white text-sm font-semibold">
                  {session?.user?.name ? getInitials(session.user.name) : "U"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden lg:flex flex-col items-start">
                <span className="text-sm font-semibold text-slate-800">
                  {session?.user?.name || "User"}
                </span>
                <span className="text-xs text-slate-500">
                  {session?.user?.roles?.[0]?.replace(/([A-Z])/g, ' $1').trim() || "User"}
                </span>
              </div>
              <ChevronDown className="hidden lg:block h-4 w-4 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="py-3">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold text-slate-800">{session?.user?.name || "User"}</p>
                <p className="text-xs text-slate-500">{session?.user?.email || ""}</p>
                {session?.user?.customerAccountName && (
                  <p className="text-xs text-primary-600 font-medium">{session.user.customerAccountName}</p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="py-2.5 cursor-pointer">
              <User className="mr-3 h-4 w-4 text-slate-500" />
              <span className="text-sm">Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="py-2.5 cursor-pointer">
              <Settings className="mr-3 h-4 w-4 text-slate-500" />
              <span className="text-sm">Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="py-2.5 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
              <Link href="/login">
                <LogOut className="mr-3 h-4 w-4" />
                <span className="text-sm font-medium">Log out</span>
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
  return (
    <div className="flex items-center gap-3 text-sm mb-6">
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="font-medium">Back</span>
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
