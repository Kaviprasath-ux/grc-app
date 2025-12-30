"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, Menu, ChevronDown, LogOut, User, Settings, Calendar, Clock, ChevronLeft } from "lucide-react";
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

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white px-4 lg:px-6">
      {/* Left side */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="text-gray-600"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Baarez Logo */}
        <div className="flex items-center gap-1">
          <svg viewBox="0 0 40 40" className="h-8 w-8">
            <circle cx="20" cy="20" r="18" fill="#1e40af" />
            <path d="M20 8 L32 20 L20 32 L8 20 Z" fill="#ef4444" />
            <circle cx="20" cy="20" r="6" fill="white" />
          </svg>
          <span className="text-xs font-bold text-red-500">Baarez</span>
        </div>

        {/* Date and Time */}
        <div className="hidden md:flex flex-col text-sm ml-4">
          <div className="flex items-center gap-2 text-gray-500">
            <Calendar className="h-4 w-4" />
            <span>Date :</span>
            <span className="text-gray-700">{format(currentTime, "dd/MM/yyyy")}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <Clock className="h-4 w-4" />
            <span>Time :</span>
            <span className="text-gray-700">{format(currentTime, "h:mm a")}</span>
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Language Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="hidden md:flex items-center gap-1 text-gray-600">
              <span className="text-sm">English, United States</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>English, United States</DropdownMenuItem>
            <DropdownMenuItem>Arabic</DropdownMenuItem>
            <DropdownMenuItem>Hindi</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-gray-600" />
              <Badge
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                variant="destructive"
              >
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notifications
              <Button variant="ghost" size="sm" className="text-xs">
                Mark All as Read
              </Button>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium">Evidence request due tomorrow</span>
              <span className="text-xs text-muted-foreground">
                Control: A.5.1.1 - Information Security Policy
              </span>
              <span className="text-xs text-muted-foreground">2 hours ago</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium">Risk assessment assigned</span>
              <span className="text-xs text-muted-foreground">
                RSK-045: Data Security Risk
              </span>
              <span className="text-xs text-muted-foreground">Yesterday</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium">New audit finding created</span>
              <span className="text-xs text-muted-foreground">
                FND-012: Access Control Gap
              </span>
              <span className="text-xs text-muted-foreground">2 days ago</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Organization Name */}
        <span className="hidden lg:block text-sm font-semibold text-gray-800">
          Baarez Technology Solutions
        </span>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-gray-300 text-gray-600">
                  BT
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">BTS Admin</p>
                <p className="text-xs text-muted-foreground">admin@baarez.com</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="text-destructive">
              <Link href="/login">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
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
    <div className="flex items-center gap-2 text-sm mb-6">
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
      >
        <ChevronLeft className="h-4 w-4" />
        <span>Back</span>
      </button>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="text-gray-300">|</span>
          {item.href ? (
            <Link href={item.href} className="text-gray-600 hover:text-gray-900">
              {item.label}
            </Link>
          ) : (
            <span className="text-blue-600 font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}
