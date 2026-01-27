"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { LucideIcon, ArrowUpRight } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: number | string;
  href?: string;
  className?: string;
  icon?: LucideIcon;
  description?: string;
}

export function StatsCard({
  label,
  value,
  href,
  className,
  icon: Icon,
  description,
}: StatsCardProps) {
  const content = (
    <div
      className={cn(
        "relative flex flex-col p-5 rounded-xl border border-slate-200 bg-white",
        className
      )}
    >
      {/* Header with icon */}
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
            <Icon className="h-5 w-5" />
          </div>
        )}
        {href && (
          <div>
            <ArrowUpRight className="h-4 w-4 text-slate-400" />
          </div>
        )}
      </div>

      {/* Value */}
      <div className="text-3xl font-bold tracking-tight text-slate-800">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>

      {/* Label and description */}
      <div className="mt-1">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        {description && (
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }

  return content;
}
